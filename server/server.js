const express = require('express')
const multiparty = require('multiparty')
const fse = require('fs-extra')
const path = require('path')
var bodyParser = require('body-parser')

const app = express()
app.listen(8000, () => {
    console.log('server is running on port 8000');
})

app.use(express.static('./'))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.all("*", function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTIONS");
    next();
});


//大文件储存目录
const UPLOAD_DIR = path.resolve(__dirname, "..", "target")

//读入
const pipeStream = (path, writeStream) =>
    new Promise(resolve => {

        const readStream = fse.createReadStream(path)
        readStream.on('end', () => {
            fse.unlinkSync(path)
            resolve()
        })
        readStream.pipe(writeStream)
    })

//合并逻辑
const mergeFileChunk = async (filePath, filename, size = 10 * 1024 * 1024) => {
    const chunkDir = path.resolve(UPLOAD_DIR, filename.split('.')[0])
    const chunkPaths = await fse.readdir(chunkDir)
    //根据下表排序
    chunkPaths.sort((a, b) => a.split('_')[1] - b.split('_')[1])

    await Promise.all(
        chunkPaths.map((chunkPath, index) => {
            return pipeStream(
                path.resolve(chunkDir, chunkPath),
                fse.createWriteStream(filePath, {
                    start: index * size,
                    end: (index + 1) * size
                })
            )
        }
        )
    )

    fse.rmdirSync(chunkDir)

}

//接受切片
app.post('/upload', (req, res) => {
    const multipart = new multiparty.Form()
    multipart.parse(req, async (err, fields, files) => {
        if (err) {
            return
        }

        const [chunk] = files.chunk
        const [hash] = fields.hash
        const [filename] = fields.filename

        const chunkDir = path.resolve(UPLOAD_DIR, filename.split('.')[0])

        //切片目录不存在则创建目录
        if (!fse.existsSync(chunkDir)) {
            await fse.mkdirs(chunkDir)
        }

        await fse.move(chunk.path, `${chunkDir}/${hash}`)

        res.end('chunk received')
    })

})

//合并切片
app.post('/merge', async (req, res) => {
    const { filename, size } = req.body

    const filePath = path.resolve(UPLOAD_DIR, `${filename}`)
    await mergeFileChunk(filePath, filename, size)

    res.end(JSON.stringify({
        code: 0,
        message: "file merged succuess"
    }))
    return
})

app.post('/verify', async (req, res) => {
    const { filename } = req.body
    const filePath = path.resolve(UPLOAD_DIR, `${filename}`);
    console.log(1111111111, filePath);
    if (fse.existsSync(filePath)) {
        res.end(JSON.stringify({
            shouldUpload: false
        }))
    } else {
        res.end(
            JSON.stringify({
                shouldUpload: true
            }))
    }

})

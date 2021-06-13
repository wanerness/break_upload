import { useState } from "react";
import './App.css';

function App() {

  const [container, setContainer] = useState({ file: null })
  const [data, setData] = useState([])

  // 切片大小
  const SIZE = 10 * 1024 * 1024

  //请求逻辑-原生
  const request = ({
    url,
    method = "post",
    data,
    headers = {},
    requestList
  }) => {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url)
      Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]))
      xhr.send(data)
      xhr.onload = e => {
        console.log('resolved');
        resolve({
          data: e.target.response
        })
      }
    })
  }

  //文件切片
  const createFileChuck = (file, size = SIZE) => {
    const fileChunkList = []
    let cur = 0
    while (cur < file.size) {
      fileChunkList.push({ file: file.slice(cur, cur + size) })
      cur += size
    }
    return fileChunkList
  }

  //上传切片
  const uploadChunks = async (uploadData = data) => {
    const start = +new Date()
    const requestList = uploadData.map(({ chunk, hash }) => {
      const formData = new FormData()
      formData.append('chunk', chunk)
      formData.append('hash', hash)
      formData.append('filename', container.file.name)
      return { formData }
    }).map(({ formData }) => {
      return request({
        url: 'http://localhost:8000/upload',
        data: formData
      })
    })

    await Promise.all(requestList)  //并发


    await mergeRequest() //合并


    const end = +new Date()
    console.log('duration----->', end - start);


  }

  const mergeRequest = async () => {
    await request({
      url: 'http://localhost:8000/merge',
      headers: {
        "content-type": 'application/json',
      },
      data: JSON.stringify({
        filename: container.file.name,
        size: SIZE
      })
    })
  }

  //文件变化
  const handleFileChange = (e) => {
    const [file] = e.target.files
    if (!file) return
    setContainer({ file })

  }

  //秒传（上传验证）
  const verifyUpload = async (filename) => {
    const { data } = await request({
      url: "http://localhost:8000/verify",
      headers: {
        "content-type": "application/json"
      },
      data: JSON.stringify({
        filename
      })
    });
    return JSON.parse(data);
  }

  //上传
  const handleUpload = async () => {
    if (!container.file) return
    const fileChunkList = createFileChuck(container.file)
    //判断你是否已上传
    const { shouldUpload } = await verifyUpload(container.file.name)
    if (!shouldUpload) {
      alert('秒传：上传成功')
      return
    }

    const data = fileChunkList.map(({ file }, index) => ({
      chunk: file,
      hash: container.file.name + '_' + index
    }))
    setData(
      data
    )

    await uploadChunks(data) //并发上传切片

  }

  return (
    <div className="App">
      <input type='file' onChange={handleFileChange} />
      <button onClick={handleUpload}>上传</button>
    </div>
  );
}

export default App;

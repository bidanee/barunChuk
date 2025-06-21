import React, { useState } from "react";
import './App.css'
import Main from "./components/Main"

export default function App(){
    const [viewType,setVeiwType] = useState("stream")
     

    return (
        <div className="wrapper">
            <header>
                <h1 className="title">바른척</h1>
                <div className="button-container">
                    <button className={`stream ${viewType == 'stream' ? 'select-view-type':''}`} onClick={(prev) => setVeiwType("stream")}>실시간 영상</button>
                    <button className={`video ${viewType == 'video' ? 'select-view-type':''}` } onClick={() => {setVeiwType("video")
                        location.assign('http://56.155.62.180:3000')
                    }}>업로드 영상</button>
                </div>
            </header>
            <main>
                <Main/>
            </main>
        </div>
    )
}
const express = require('express');
const app = express();

app.get('/',function(req, res){
  res.send()
})
app.get("/health", function(req,res){
  res.status(200).send("OK");
  console.log("health check")
})

app.listen(3000, function () {
  console.log("3000 Port : Server Started~!!!");
});


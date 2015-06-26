package org.playarimaa.server
import org.scalatra._
import scalate.ScalateSupport

import org.json4s.{DefaultFormats, Formats}
import org.scalatra.json._


case class Response(message: String, message2: Option[String], timestamp: Long)
object Response {
  def create(message: String): Response = {
    val timestamp = System.currentTimeMillis()
    Response(message,None,timestamp)
  }
  def create(message: String, message2: String): Response = {
    val timestamp = System.currentTimeMillis()
    Response(message,Some(message2),timestamp)
  }
}

case class Request(a: Int, b:Int)

//TODO: add error handling for malformed input
/*
val errorHandling: PartialFunction[Throwable, Unit] = {
  case e:java.util.NoSuchElementException => send_error("DB malformed", InternalError)
  case e => send_error("Internal Error", InternalError)
}*/

class ArimaaServlet extends WebAppStack with JacksonJsonSupport with ScalateSupport {
  // Sets up automatic case class to JSON output serialization, required by
  // the JValueResult trait.
  protected implicit lazy val jsonFormats: Formats = DefaultFormats

  // Before every action runs, set the content type to be in JSON format.
  before() {
    contentType = formats("json")
  }

  //curl -i http://localhost:8080/
  get("/") {

    //
    contentType="text/html"
    //layoutTemplate("/WEB-INF/views/hello.jade")
    //jade("/WEB-INF/views/index.jade", "layout" -> "/WEB-INF/layouts/basic_layout.jade")
    jade("/WEB-INF/views/hello.jade", "layout"->"/WEB-INF/layouts/default.jade")
    //Response.create("Hello world")
  }

  //curl -i -X POST -d "name=sally" http://localhost:8080/test
  post("/test") {
    val name = params("name")
    Response.create("Hello " + name,"foo")
  }

  //curl -i -H "Content-Type: application/json" -X POST -d '{"a":2, "b":3}' http://localhost:8080/test2
  post("/test2") {
    val r = parse(request.body).extract[Request]
    Response.create("" + (r.a + r.b))
  }




}
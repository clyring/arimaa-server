package org.playarimaa.server
import org.scalatra.{Accepted, ScalatraServlet}
import org.scalatra.scalate.ScalateSupport

import org.json4s.{DefaultFormats, Formats}
import org.scalatra.json.JacksonJsonSupport
import org.json4s.jackson.Serialization

import org.playarimaa.server.CommonTypes._
import org.playarimaa.server.Utils._

object ArimaaServlet {
  object IOTypes {
    case class SimpleError(error: String)
  }
}

import org.playarimaa.server.AccountServlet._

class ArimaaServlet(val siteLogin: SiteLogin)
    extends WebAppStack with JacksonJsonSupport with ScalateSupport {
  // Sets up automatic case class to JSON output serialization, required by
  // the JValueResult trait.
  protected implicit lazy val jsonFormats: Formats = DefaultFormats

  def notLoggedIn(cookies: scala.collection.Map[String,String]): Boolean = {
    cookies.get("siteAuth") match {
      case None => true
      case Some(auth) => !siteLogin.isAuthLoggedIn(auth)
    }
  }

  // Before every action runs, set the content type to be in JSON format.
  before() {
    contentType = formats("json")
  }

  //curl -i http://localhost:8080/
  //eventually, we'll only need this and do some client side routing to determine which page to render
  get("/") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/login/?") {
    redirect("/") : Any
  }

  get("/register/?") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/forgotPassword/?") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/gameroom/?") {
    if(notLoggedIn(request.cookies))
      redirect("/")
    else {
      contentType="text/html"
      val path = "/board.html"
      new java.io.File( getServletContext().getResource(path).getFile )
    }
  }

  get("/resetPassword/:username/:resetAuth/?") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/verifyEmail/:username/:verifyAuth/?") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/resendVerifyEmail/?") {
    if(notLoggedIn(request.cookies))
      redirect("/")
    else {
      contentType="text/html"
      val path = "/board.html"
      new java.io.File( getServletContext().getResource(path).getFile )
    }
  }

  get("/game/:gameid/?") {
    contentType="text/html"
    val path = "/board.html"
    new java.io.File( getServletContext().getResource(path).getFile )
  }

  get("/chat/:chatchannel/?") {
    if(notLoggedIn(request.cookies))
      redirect("/")
    else {
      contentType="text/html"
      val path = "/board.html"
      new java.io.File( getServletContext().getResource(path).getFile )
    }
  }

  get("/debug/?") {
    if(Mode.isProd)
      Json.write(IOTypes.SimpleError("Debug page not available in production mode"))
    else {
      contentType="text/html"
      val path = "/board.html"
      new java.io.File( getServletContext().getResource(path).getFile )
    }
  }
}

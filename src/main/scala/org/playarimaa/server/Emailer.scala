package org.playarimaa.server
import scala.concurrent.{ExecutionContext, Future, Promise, future}
import java.util.Properties
import javax.mail.{Message,Session,Transport}
import javax.mail.internet.{InternetAddress,MimeMessage}

import org.playarimaa.server.CommonTypes._

class Emailer(siteName: String, siteAddress: String, smtpHost: String, smtpPort: String, smtpAuth: Boolean, noReplyAddress: String)(implicit ec: ExecutionContext) {

  val siteLink : String =
    List("<a href=\"",siteAddress,"\">",siteName,"</a>").mkString("")

  def send(to: Email, subject: String, body: String): Future[Unit] = {
    Future {
      val props = new Properties()
      props.put("mail.smtp.host", smtpHost)
      props.put("mail.smtp.port", smtpPort)
      if(smtpAuth) {
        props.put("mail.smtp.auth", "true")
        props.put("mail.smtp.starttls.enable", "true")
      }

      val session = Session.getDefaultInstance(props, null)
      val message: Message = new MimeMessage(session)
      message.setFrom(new InternetAddress(noReplyAddress))
      message.addRecipient(Message.RecipientType.TO, new InternetAddress(to))
      message.setSubject(subject)
      message.setText(body)
      Transport.send(message)
    }
  }

  def sendPasswordResetRequest(to: Email, username: Username, auth: Auth): Future[Unit] = {
    val subject = "Password reset requested"
    //TODO make this more user-friendly in conjunction with an appropriate UI page
    val body = List(
      "A password reset was requested for your account \"",
      username,
      "\" at ",
      siteLink,
      ". You may reset your password using the following resetAuth: ",
      auth,
      ". If you did not make this request or did not intend to request this password reset, please ignore this email."
    ).mkString("")

    send(to,subject,body)
  }

  //TODO use this
  def sendPasswordResetNoAccount(to: Email): Future[Unit] = {
    val subject = "Password reset requested for unknown account"
    val body = List(
      "A password reset was requested by you (or someone else) at ",
      siteLink,
      " for this email address. ",
      "However, there is no account with this email address, so no password reset has been initiated. ",
      "If you made this request, please try again with the email address associated with your account. Otherwise, please ignore this email."
    ).mkString("")

    send(to,subject,body)
  }

}
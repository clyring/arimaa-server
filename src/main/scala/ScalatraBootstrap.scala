
//Note that the Scalatra web framework appears to expect this bootstrap file to be in the root package.
import org.playarimaa.server._
import org.playarimaa.server.game._
import org.scalatra._
import javax.servlet.ServletContext
import _root_.akka.actor.ActorSystem
import scala.concurrent.ExecutionContext

import java.security._

import scala.concurrent.Await
import scala.concurrent.duration.Duration
import slick.driver.H2Driver.api._

object ArimaaServerInit {
  private var initialized = false
  def initialize = {
    this.synchronized {
      if(!initialized) {
        //Initalize CSPRNG on startup
        RandGen.initialize

        //Initialize in-memory database and create tables for testing
        val db = Database.forConfig("h2mem1")
        Await.result(db.run(DBIO.seq(
          ( ChatSystem.table.schema ++
            Games.gameTable.schema ++
            Games.movesTable.schema
          ).create
        )), Duration.Inf)
        initialized = true
      }
    }
  }
}

class ScalatraBootstrap extends LifeCycle {
  val system = ActorSystem()

  override def init(context: ServletContext) {
    ArimaaServerInit.initialize
    context.mount(new ArimaaServlet, "/*")

    val chatContext: ExecutionContext = system.dispatcher
    context.mount(new ChatServlet(system,chatContext), "/api/chat/*")
  }
}

var React = require('react');
var SiteActions = require('../actions/SiteActions.js');
var UserStore = require('../stores/UserStore.js');
var Link = require('react-router').Link;

var forgotPasswordBox = React.createClass({
  getInitialState: function() {
    return {user: "", message: "", error: ""};
  },

  componentDidMount: function() {
    UserStore.addChangeListener(this.onUserStoreChange);
  },
  componentWillUnmount: function() {
    UserStore.removeChangeListener(this.onUserStoreChange);
  },

  onUserStoreChange: function() {
    this.setState(UserStore.getMessageError());
  },

  handleUsernameChange: function(event) {
    this.setState({user: event.target.value});
  },
  submitForgotPassword: function(event) {
    event.preventDefault();
    SiteActions.forgotPassword(this.state.user);
  },

  render: function() {
    var errorText = null;
    if(this.state.error != "") {
      errorText = (<div className="error">{this.state.error}</div>);
    }
    var messageText = null;
    //TODO it's weird to use the "forgotpass" class for the div
    if(this.state.message != "") {
      messageText = (<div className="forgotpass">{this.state.message}</div>);
    }

    return (
      <div>
        <div className="login">
          <h1>Request Password Reset</h1>
          <form method="post" action="index.html">
            <input type="text" name="forgotPassword" value={this.state.user} onChange={this.handleUsernameChange} placeholder="Username/Email"/>
            <input type="submit" className="submit" name="commit" value="Request Password Reset" onClick={this.submitForgotPassword}/>
          </form>
          {errorText}
          {messageText}
          <div><Link to="/">Back to Login</Link></div>
        </div>
      </div>
    );
  }
});

module.exports = forgotPasswordBox;

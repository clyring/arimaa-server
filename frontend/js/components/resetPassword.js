var React = require('react');
var SiteActions = require('../actions/SiteActions.js');
var UserStore = require('../stores/UserStore.js');

var registrationBox = React.createClass({
  getInitialState: function() {
    return {pass: "", confirmPass: "", message: "", error: ""};
  },
  handlePasswordChange: function(event) {
    this.setState({pass: event.target.value});
  },
  handleConfirmPasswordChange: function(event) {
    this.setState({confirmPass: event.target.value});
  },
  submitResetPassword: function(event) {
    event.preventDefault();
    //TODO eventually, we will have to add a local check for pass match, etc
    SiteActions.resetPassword(this.props.username, this.props.resetAuth, this.state.pass);
  },
  componentDidMount: function() {
     UserStore.addChangeListener(this._onChange);
  },
  componentWillUnmount: function() {
    UserStore.removeChangeListener(this._onChange);
  },

  _onChange: function() {
    this.setState(UserStore.getLoginState());
  },

  render: function() {
    //var value = this.state.value;
    //return <input type="text" value={value} onChange={this.handleChange} />;

    var errorText = null;
    var messageText = null;
    //is empty string falsey?
    if(this.state.error != "") {
      errorText = (<div className="error">{this.state.error}</div>);
    }
    var messageText = null;
    //TODO it's weird to use the "forgotpass" class for the div
    if(this.state.message != "") {
      messageText = (<div className="forgotpass">{this.state.message}</div>);
    }

    //TODO here and elsewhere, should we be disabling the buttons upon submit so that we don't accidentally get double-sends of requests?
    //TODO it's weird to use the "forgotpass" class for the div
    return (
      <div>
        <div className="login">
          <h1>Reset Password</h1>
          <form method="post" action="index.html">
            <input type="password" name="password" value={this.state.pass} onChange={this.handlePasswordChange} placeholder="New Password"/>
            <input type="password" name="confirmPassword" value={this.state.confirmPass} onChange={this.handleConfirmPasswordChange} placeholder="Confirm New Password"/>
            <input type="submit" className="submit" name="commit" value="Set New Password" onClick={this.submitResetPassword}/>
          </form>
          {errorText}
          <div className="forgotpass"><a href="/login">Back to login</a></div>
        </div>
      </div>
    )
  }
});

module.exports = registrationBox;
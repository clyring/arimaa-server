var React = require('react');

var ArimaaStore = require('../stores/ArimaaStore.js');
var ArimaaActions = require('../actions/ArimaaActions.js');
var ArimaaConstants = require('../constants/ArimaaConstants.js');

var Utils = require('../utils/Utils.js');

var GameClock = React.createClass({
  getInitialState: function() {
    return {
      clock: ArimaaStore.getTopClockRemaining(false),
      playerInfo: ArimaaStore.getTopUserInfo()
    };
  },

  _onChange: function() {
    this.setState({
      clock: ArimaaStore.getTopClockRemaining(false),
      playerInfo: ArimaaStore.getTopUserInfo()
    });
  },

  componentDidMount: function() {
    ArimaaStore.addChangeListener(this._onChange);
    this.interval = setInterval(this._onChange,150);
  },

  componentWillUnmount: function() {
    ArimaaStore.removeChangeListener(this._onChange);
    clearInterval(this.interval);
  },

  render: function() {
    //console.log(ArimaaStore.getGameState());
    var clock = this.state.clock;
    var formatted = "-:--";
    if(clock !== null)
      formatted = Utils.timeSpanToString(Math.max(0,clock));

    var userInfoString = Utils.userDisplayStr(this.state.playerInfo);

    return (
      <div className={"topPlayerInfo"}>
        {formatted}
        <br/>
        {userInfoString}
      </div>
    );
  }

});

module.exports = GameClock;

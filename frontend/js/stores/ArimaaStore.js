'use strict';

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var ArimaaDispatcher = require('../dispatcher/ArimaaDispatcher.js');
var SiteConstants = require('../constants/SiteConstants.js');
var ArimaaConstants = require('../constants/ArimaaConstants.js');
var Arimaa = require('../lib/arimaa.js');
var APIUtils = require('../utils/WebAPIUtils.js');
var Utils = require('../utils/Utils.js');

const CHANGE_EVENT = 'change';
const MOVE_EVENT = 'new-move';

var debugMsg = "";

var _gameID = null;
var _gameAuth = null;
var _gameState = null;

var _localTimeOffsetFromServer = null;
var _lastStateReceivedTime = null;

//TODO avoid having a default setup and instead go by click-to-place?
//TODO support handicap setups
//TODO display captured pieces
var _setupGold   = ['R','H','C','M','E','C','H','R','R','R','R','D','D','R','R','R']; //a2-h2, a1-h1 //default gold setup
var _setupSilver = ['r','r','r','d','d','r','r','r','r','h','c','e','m','c','h','r']; //a8-h8, a7-h7 //default silver setup
var _currentSetup = []; //the current setup the user chooses
var _setupColor = ArimaaConstants.GAME.NULL_COLOR;

var _arimaa = new Arimaa();

//TODO: remove these square nums since they're inconsistent with the arimaajs internal square numbers
//actually the arimaajs square numbers shouldn't be used outside of arimaajs, so
//switch to only using square names for equality checks, etc
var _selSquareNum = ArimaaConstants.GAME.NULL_SQUARE_NUM;
var _selSquareName = "";
var _validSteps = [];

//Sent query to server to move but not received reply yet
var _sendingMoveNow = false;

var _myColor = ArimaaConstants.GAME.NULL_COLOR; //spectators, or before we know what color we are
var _viewSide = ArimaaConstants.GAME.GOLD; //can only be gold or silver (unless we want east/west views?) //color on bottom moving up
var _colorToMove = ArimaaConstants.GAME.NULL_COLOR; //in this context, null color === can't move
var _sequenceNum = 0;
setInitialState();

const ArimaaStore = Object.assign({}, EventEmitter.prototype, {
  getGameState: function() {
    return _gameState;
  },

  getSetupColor: function() {
    return _setupColor;
  },

  getColorToMove: function() {
    return _colorToMove;
  },

  getSetup: function() {
    return _currentSetup;
  },

  getMyColor: function() {
    return _myColor;
  },

  getViewSide: function() {
    return _viewSide;
  },

  getDebugMsg: function() {
    return debugMsg;
  },

  getArimaa: function() {
    return _arimaa;
  },

  isSendingMoveNow: function() {
    return _sendingMoveNow;
  },

  isOurTurn: function() {
    return _myColor !== ArimaaConstants.GAME.NULL_COLOR && _myColor === _colorToMove;
  },

  isSpectator: function() {
    return _myColor === ArimaaConstants.GAME.NULL_COLOR
      || _gameState === null
      || !(_gameState.meta.activeGameData);
  },

  canUndo: function() {
    return _arimaa.can_undo_step();
  },

  canRedo: function() {
    return _arimaa.can_redo_step();
  },

  getOngoingMove: function() {
    return _arimaa.get_ongoing_move_string();
  },

  getBoard: function() {
    console.log('board: ', _arimaa.get_board());
    return _arimaa.get_board();
  },

  getMoveList: function() {
    var moves = _arimaa.get_move_list();
    return moves;
  },

  getPlayerOfPos: function(pos) {
    if(_gameState === null) return (pos === "top" ? ArimaaConstants.GAME.SILVER : ArimaaConstants.GAME.GOLD);

    if((pos === "top" && _viewSide === ArimaaConstants.GAME.GOLD) ||
     (pos === "bottom" && _viewSide === ArimaaConstants.GAME.SILVER)) {
      return ArimaaConstants.GAME.SILVER;
    } else {
      return ArimaaConstants.GAME.GOLD;
    }
  },

  getUserInfo: function(pos) {
    if(_gameState === null) return null;

    if((pos === "top" && _viewSide === ArimaaConstants.GAME.GOLD) ||
     (pos === "bottom" && _viewSide === ArimaaConstants.GAME.SILVER)) {
      return _gameState.meta.sUser;
    } else {
      return _gameState.meta.gUser;
    }
  },

  getTCOfPos: function(pos) {
    if(_gameState === null) return null;

    if((pos === "top" && _viewSide === ArimaaConstants.GAME.GOLD) ||
     (pos === "bottom" && _viewSide === ArimaaConstants.GAME.SILVER)) {
      return _gameState.meta.sTC;
    } else {
      return _gameState.meta.gTC;
    }
  },

  //pos should be "top" or "bottom"
  //wholeGame specifies whether it should be the time left for just this move or it should be the time on the clock for the whole game
  getClockRemaining: function(pos,wholeGame) {
    if(_gameState === null) return null;

    var player;
    if((pos === "top" && _viewSide === ArimaaConstants.GAME.GOLD) ||
     (pos === "bottom" && _viewSide === ArimaaConstants.GAME.SILVER)) {
      player = "s";
    } else {
      player = "g";
    }

    if(_gameState.meta.activeGameData === undefined) {
      //An open game - don't display any clocks
      if(_gameState.meta.result === undefined)
        return null;
      //An ended game - display the ended time
      else
        return Utils.clockRecomputeDirectly(player,_gameState);
    }

    var baseClock = (player == "g") ? _gameState.meta.activeGameData.gClockBeforeTurn : _gameState.meta.activeGameData.sClockBeforeTurn;
    if(_gameState.toMove != player)
      return baseClock;

    var now = Utils.currentTimeSeconds();
    var timeSpent = 0;
    if(_localTimeOffsetFromServer !== null)
      timeSpent = now - _gameState.meta.activeGameData.moveStartTime - _localTimeOffsetFromServer;
    else if(_lastStateReceivedTime !== null)
      timeSpent = now - _lastStateReceivedTime - _gameState.meta.activeGameData.timeSpent;

    var tc = (player == "g") ? _gameState.meta.gTC : _gameState.meta.sTC;
    var clock = Utils.clockAfterTurn(baseClock,timeSpent,Math.floor(_gameState.plyNum / 2),tc);
    if(!wholeGame && tc.maxMoveTime !== undefined)
      clock = Math.min(clock, tc.maxMoveTime - timeSpent);
    return clock;
  },

  getSelectedSquare: function() {
    return {
      num: _selSquareNum,
      name: _selSquareName
    };
  },

  getValidSteps: function() {
    return _validSteps;
  },

  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },


  sendMoveToServer: function(gameID,gameAuth,moveStr,plyNum) {
    ArimaaStore.setSelectedSquareToNull();
    APIUtils.sendMove(gameID,gameAuth,moveStr,plyNum,ArimaaStore.sendMoveToServerSuccess,ArimaaStore.sendMoveToServerError);
  },
  sendMoveToServerSuccess: function(data) {
    ArimaaDispatcher.dispatch({
      actionType: ArimaaConstants.ACTIONS.SENT_MOVE_TO_SERVER,
      data:data
    });
  },
  sendMoveToServerError: function(data) {
    ArimaaDispatcher.dispatch({
      actionType: ArimaaConstants.ACTIONS.SENT_MOVE_TO_SERVER_FAILED,
      data:data
    });
  },

  setSelectedSquare: function(square) {
    _selSquareNum = square.squareNum;
    _selSquareName = square.squareName;
    _validSteps = _arimaa.generate_steps_for_piece_on_square(_selSquareName);
  },

  setSelectedSquareToNull: function() {
    _selSquareNum = ArimaaConstants.GAME.NULL_SQUARE_NUM; //TODO also move these to a function
    _selSquareName = "";
    _validSteps = [];
  },

  dispatcherIndex: ArimaaDispatcher.register(function(action) {

    function _setSelectedSquare(square) {
      ArimaaStore.setSelectedSquare(square);
    }

    function _setSelectedSquareToNull() {
      ArimaaStore.setSelectedSquareToNull();
    }

    switch(action.actionType) {
    case ArimaaConstants.ACTIONS.INITIAL_STATE_FAILED:
      debugMsg = "Failed to get initial game state, try refreshing page: " + action.data.error;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_JOIN_FAILED:
      debugMsg = "Failed to join game, try refreshing page: " + action.data.error;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.HEARTBEAT_FAILED:
      debugMsg = "Failed to heartbeat game, try refreshing page: " + action.data.error;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.SENT_MOVE_TO_SERVER_FAILED:
      debugMsg = "Failed to send move: " + action.data.error;
      _sendingMoveNow = false;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_STATE_FAILED:
      debugMsg = "Failed to get game state, try refreshing page: " + action.data.error;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.SENT_MOVE_TO_SERVER:
      debugMsg = "";
      _sendingMoveNow = false;
      ArimaaStore.emitChange();
      break;

    case ArimaaConstants.ACTIONS.GAME_STATE:
      _gameState = action.data;

      //Logic for trying to sync up server and local clocks as closely as possible from gameroom clock
      _lastStateReceivedTime = Utils.currentTimeSeconds();
      var crazyTimeSpan = 1200; //20 minutes
      var estimatedTimeOffset = _lastStateReceivedTime - _gameState.meta.now;

      //Figure out the offset we are from the server based by taking a min over all of the time offsets we've seen
      //so far, except that if the difference is crazy, then forget history and take the new value
      if(_localTimeOffsetFromServer === null
         || _localTimeOffsetFromServer > estimatedTimeOffset
         || _localTimeOffsetFromServer < estimatedTimeOffset - crazyTimeSpan)
        _localTimeOffsetFromServer = estimatedTimeOffset;

      //Figure out whose turn it is and if the game is over
      if(_gameState.meta.result) {
        _colorToMove = ArimaaConstants.GAME.NULL_COLOR;
      }
      else if(_gameState.meta.numPly % 2 === 0)
        _colorToMove = ArimaaConstants.GAME.GOLD;
      else
        _colorToMove = ArimaaConstants.GAME.SILVER;

      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_JOINED:
      _gameID = action.gameID;
      _gameAuth = action.gameAuth;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_SET_COLOR:
      _myColor = action.color;
      if(_myColor === ArimaaConstants.GAME.SILVER) {
        _viewSide = ArimaaConstants.GAME.SILVER;
      } else {
        _viewSide = ArimaaConstants.GAME.GOLD;
      }
      ArimaaStore.emitChange();
      break;
      //used after getting game status from server
      //to signal we should enter a setup
    case ArimaaConstants.ACTIONS.GAME_SETUP_GOLD:
      //we only show the pieces for setup when its our turn to setup
      if(_myColor === ArimaaConstants.GAME.GOLD) {
        _currentSetup = _setupGold;
        _setupColor = ArimaaConstants.GAME.GOLD;
      }
      ArimaaStore.emitChange();
      break;
      //also used after getting status from server
    case ArimaaConstants.ACTIONS.GAME_SETUP_SILVER:
      //we only show the pieces for setup when its our turn to setup,
      if(_myColor === ArimaaConstants.GAME.SILVER) {
        _currentSetup = _setupSilver;
        _setupColor = ArimaaConstants.GAME.SILVER;
      }
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_SETUP_OVER:
      _setupColor = ArimaaConstants.GAME.NULL_COLOR;
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_SEND_SETUP:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;

      var moveStr = "";
      if(_myColor === ArimaaConstants.GAME.GOLD) {
        for(var i=0;i<2;i++) {
          for(var j=0;j<8;j++) {
            moveStr += _currentSetup[8*i+j]+ArimaaConstants.GAME.FILES[j]+(2-i).toString()+" ";
          }
        }
      } else {
        for(var i=0;i<2;i++) {
          for(var j=0;j<8;j++) {
            moveStr += _currentSetup[8*i+j]+ArimaaConstants.GAME.FILES[j]+(8-i).toString()+" ";
          }
        }
      }

      //TODO test
      //We don't make the setup locally, we send to the server and wait to ensure we stay in sync
      //with the server
      var completed = _arimaa.can_setup();
      if(completed.success) {
        _sendingMoveNow = true;
        ArimaaStore.sendMoveToServer(action.gameID, _gameAuth, moveStr, _arimaa.get_halfmove_number());
      } else {
        debugMsg = completed.reason;
      }
      break;

      //debug methods to send setup as text
      //only used in debug component
    case ArimaaConstants.ACTIONS.DEBUG_SEND_SETUP_GOLD:
      _arimaa.setup(action.text);
      ArimaaStore.sendMoveToServer(action.gameID, _gameAuth, action.text, 0);
      ArimaaStore.emitChange();
      //usually, this is done with the game_setup_silver action,
      //but for local games where we don't go through the network
      //we do this here
      _currentSetup = _silverSetup;

      break;
    case ArimaaConstants.ACTIONS.DEBUG_SEND_SETUP_SILVER:
      _arimaa.setup(action.text);
      ArimaaStore.sendMoveToServer(action.gameID, _gameAuth, action.text, 1);
      ArimaaStore.emitChange();
      break;

    case ArimaaConstants.ACTIONS.GAME_HOVER_SQUARE:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;
      //Do nothing unless we're in hover-click mode
      if(Utils.getSetting(SiteConstants.SETTINGS.MOVEMENT_MODE_KEY, SiteConstants.SETTINGS.MOVEMENT_MODE.DEFAULT) !== SiteConstants.SETTINGS.MOVEMENT_MODE.HOVERCLICK)
        break;

      //Only act outside of the setup
      if(_setupColor === ArimaaConstants.GAME.NULL_COLOR) {
        if(!_arimaa.is_empty(action.squareName)) {
          _setSelectedSquare(action);
          ArimaaStore.emitChange();
        }
      }
      break;

    case ArimaaConstants.ACTIONS.GAME_HOVERED_AWAY:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;

      //Do nothing unless we're in hover-click mode
      if(Utils.getSetting(SiteConstants.SETTINGS.MOVEMENT_MODE_KEY, SiteConstants.SETTINGS.MOVEMENT_MODE.DEFAULT) !== SiteConstants.SETTINGS.MOVEMENT_MODE.HOVERCLICK)
        break;
      //Only act outside of the setup
      if(_setupColor === ArimaaConstants.GAME.NULL_COLOR) {
        _setSelectedSquareToNull();
        ArimaaStore.emitChange();
      }
      break;

    case ArimaaConstants.ACTIONS.GAME_CLICK_SQUARE:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;

      //GOLD SETUP----------------------------------------------------------------
      if(_setupColor === ArimaaConstants.GAME.GOLD) {
        if(action.squareNum < 48) { //TODO ideally, we wouldn't use these magic numbers
          _setSelectedSquareToNull();
        } else if(_selSquareNum === ArimaaConstants.GAME.NULL_SQUARE_NUM) {
          _setSelectedSquare(action);
        } else {
          var temp = _currentSetup[action.squareNum-48];
          _currentSetup[action.squareNum-48] = _currentSetup[_selSquareNum-48];
          _currentSetup[_selSquareNum-48] = temp;
          _setSelectedSquareToNull();
        }
      }
      //SILVER SETUP---------------------------------------------------------------
      else if(_setupColor === ArimaaConstants.GAME.SILVER) {
        if(action.squareNum > 16) {
          _setSelectedSquareToNull();
        } else if(_selSquareNum === ArimaaConstants.GAME.NULL_SQUARE_NUM) {
          _setSelectedSquare(action);
        } else {
          var temp = _currentSetup[action.squareNum];
          _currentSetup[action.squareNum] = _currentSetup[_selSquareNum];
          _currentSetup[_selSquareNum] = temp;
          _setSelectedSquareToNull();
        }
      }
      //REGULAR GAME---------------------------------------------------------------
      else {
        //TODO USE IF_EMPTY FUNCTION AFTER UPDATING ARIMAAJS
        if (_selSquareNum === action.squareNum) {
          //Deselect the current square if we clicked it again and we're in click-click mode
          if(Utils.getSetting(SiteConstants.SETTINGS.MOVEMENT_MODE_KEY, SiteConstants.SETTINGS.MOVEMENT_MODE.DEFAULT) === SiteConstants.SETTINGS.MOVEMENT_MODE.CLICKCLICK)
            _setSelectedSquareToNull();
        }
        else if(!_arimaa.is_empty(action.squareName)) {
          _setSelectedSquare(action);
        }
        else if(_selSquareNum !== ArimaaConstants.GAME.NULL_SQUARE_NUM) {
          var stepToAdd = null;
          _validSteps.forEach(function(s) {
            if(s.destSquare === action.squareName) stepToAdd = s;
          });
          if(stepToAdd) {
            var k = _arimaa.add_step(stepToAdd.string);
            //TODO USE if_empty function after updating arimaajs!!!!
            //Handle the case where the piece disappears due to a sacrifice
            if(!_arimaa.is_empty(stepToAdd.destSquare)) {
              _setSelectedSquare(action);
            }
            else {
              _setSelectedSquareToNull();
            }
          }
          else {
            _setSelectedSquareToNull();
          }
        }
      }
      ArimaaStore.emitChange();
      break;


    case ArimaaConstants.ACTIONS.GAME_UNDO_STEP:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;
      var undo = _arimaa.undo_step();
      if(undo) {
        _setSelectedSquare({squareNum:undo.squareNum,squareName:undo.square});
        ArimaaStore.emitChange();
      }
      break;
    case ArimaaConstants.ACTIONS.GAME_REDO_STEP:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;
      var redo = _arimaa.redo_step();
      if(redo) {
        _setSelectedSquare({squareNum:redo.destSquareNum,squareName:redo.destSquare});
        ArimaaStore.emitChange();
      }
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_REDO_MOVE:
      break;
    case ArimaaConstants.ACTIONS.GAME_ADD_MOVE:
      _arimaa.undo_ongoing_move();
      var moveStr = action.move;
      _setSelectedSquareToNull();
      var completed = _arimaa.add_move_string(moveStr);
      if(!completed.success) {
        debugMsg = completed.reason;
      }
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_COMPLETE_MOVE:
      //Do nothing unless we're one of the players AND it's our turn
      if(!ArimaaStore.isOurTurn())
        break;
      //Don't actually complete the move, because if the server rejects our move for any reason, we'll enter into an inconsistent state having
      //played the move locally but not having it accepted by the server.
      //When the server gamestate comes back to us, we'll blow away our partial step state and update properly via _arimaa.add_move_string above.
      var completed = _arimaa.can_complete_move();
      if(completed.success) {
        //TODO definitely need a better way of doing this...
        //converts list of step strings to single move string
        var ongoingMove = _arimaa.get_ongoing_move();
        var moveStr = ongoingMove.map(function(s) {return s.string;}).join(' ');

        //Send move to server
        _sendingMoveNow = true;
        ArimaaStore.sendMoveToServer(action.gameID, _gameAuth, moveStr, _arimaa.get_halfmove_number());
      } else {
        debugMsg = completed.reason;
      }
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_FLIP_BOARD:
      _viewSide = ArimaaConstants.GAME.reverseColor(_viewSide);
      _setSelectedSquareToNull();
      ArimaaStore.emitChange();
      break;
    case ArimaaConstants.ACTIONS.GAME_RESIGN:
      APIUtils.resignGame(action.gameID, _gameAuth,ArimaaStore.sendMoveToServerSuccess,ArimaaStore.sendMoveToServerError);
      break;
    default:
      break;
    }
    return true; // No errors. Needed by promise in Dispatcher.
  })

});

function setInitialState() {
  _arimaa = new Arimaa();
  _currentSetup = _setupGold;
}

module.exports = ArimaaStore;

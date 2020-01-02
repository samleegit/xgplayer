var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

import FlvDemuxer from 'xgplayer-transmuxer-demux-flv';
import FetchLoader from 'xgplayer-transmuxer-loader-fetch';
import EVENTS from 'xgplayer-transmuxer-constant-events';

import Tracks from 'xgplayer-transmuxer-buffer-track';
import XgBuffer from 'xgplayer-transmuxer-buffer-xgbuffer';

import Player from 'xgplayer';

var DEMUX_EVENTS = EVENTS.DEMUX_EVENTS;
var LOADER_EVENTS = EVENTS.LOADER_EVENTS;

var Tag = 'FLVController';

var Logger = function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, [{
    key: 'warn',
    value: function warn() {}
  }]);

  return Logger;
}();

var FLV_ERROR = 'FLV_ERROR';

var FlvController = function () {
  function FlvController(player) {
    _classCallCheck(this, FlvController);

    this.TAG = Tag;
    this._player = player;
    this.state = {
      initSegmentArrived: false,
      randomAccessPoints: []
    };

    this.bufferClearTimer = null;
  }

  _createClass(FlvController, [{
    key: 'init',
    value: function init() {

      this.initComponents();
      this.initListeners();
    }
  }, {
    key: 'initComponents',
    value: function initComponents() {
      this._context.registry('FETCH_LOADER', FetchLoader);
      this._context.registry('LOADER_BUFFER', XgBuffer);

      this._context.registry('FLV_DEMUXER', FlvDemuxer);
      this._context.registry('TRACKS', Tracks);

      this._context.registry('LOGGER', Logger);
    }
  }, {
    key: 'initListeners',
    value: function initListeners() {
      this.on(LOADER_EVENTS.LOADER_DATALOADED, this._handleLoaderDataLoaded.bind(this));
      this.on(LOADER_EVENTS.LOADER_ERROR, this._handleNetworkError.bind(this));

      this.on(DEMUX_EVENTS.MEDIA_INFO, this._handleMediaInfo.bind(this));
      this.on(DEMUX_EVENTS.METADATA_PARSED, this._handleMetadataParsed.bind(this));
      this.on(DEMUX_EVENTS.DEMUX_COMPLETE, this._handleDemuxComplete.bind(this));
      this.on(DEMUX_EVENTS.DEMUX_ERROR, this._handleDemuxError.bind(this));
      this.on(DEMUX_EVENTS.SEI_PARSED, this._handleSEIParsed.bind(this));
    }
  }, {
    key: '_handleMediaInfo',
    value: function _handleMediaInfo() {
      if (!this._context.mediaInfo) {
        this.emit(DEMUX_EVENTS.DEMUX_ERROR, new Error('failed to get mediainfo'));
      }
    }
  }, {
    key: '_handleLoaderDataLoaded',
    value: function _handleLoaderDataLoaded() {
      this.emitTo('FLV_DEMUXER', DEMUX_EVENTS.DEMUX_START);
    }
  }, {
    key: '_handleSEIParsed',
    value: function _handleSEIParsed(sei) {
      this._player.emit('SEI_PARSED', sei);
    }
  }, {
    key: '_handleDemuxComplete',
    value: function _handleDemuxComplete() {
      if (this._player.video) {
        var _context$getInstance = this._context.getInstance('TRACKS'),
            videoTrack = _context$getInstance.videoTrack,
            audioTrack = _context$getInstance.audioTrack;

        this._player.video.onDemuxComplete(videoTrack, audioTrack);
      }
    }
  }, {
    key: '_handleMetadataParsed',
    value: function _handleMetadataParsed(type) {
      if (type === 'audio') {
        // 将音频meta信息交给audioContext，不走remux封装
        var _context$getInstance2 = this._context.getInstance('TRACKS'),
            audioTrack = _context$getInstance2.audioTrack;

        if (audioTrack && audioTrack.meta) {
          this._setMetaToAudio(audioTrack.meta);
        }
      } else {
        var _context$getInstance3 = this._context.getInstance('TRACKS'),
            videoTrack = _context$getInstance3.videoTrack;

        if (videoTrack && videoTrack.meta) {
          this._setMetaToVideo(videoTrack.meta);
        }
      }
    }
  }, {
    key: '_setMetaToAudio',
    value: function _setMetaToAudio(audioMeta) {
      if (this._player.video) {
        this._player.video.setAudioMeta(audioMeta);
      }
    }
  }, {
    key: '_setMetaToVideo',
    value: function _setMetaToVideo(videoMeta) {
      if (this._player.video) {
        this._player.video.setVideoMeta(videoMeta);
      }
    }
  }, {
    key: '_handleAppendInitSegment',
    value: function _handleAppendInitSegment() {
      this.state.initSegmentArrived = true;
    }
  }, {
    key: '_handleNetworkError',
    value: function _handleNetworkError(tag, err) {
      this._player.emit('error', new Player.Errors('network', this._player.config.url));
      this._onError(LOADER_EVENTS.LOADER_ERROR, tag, err, true);
    }
  }, {
    key: '_handleDemuxError',
    value: function _handleDemuxError(tag, err, fatal) {
      if (fatal === undefined) {
        fatal = false;
      }
      this._player.emit('error', new Player.Errors('parse', this._player.config.url));
      this._onError(DEMUX_EVENTS.DEMUX_ERROR, tag, err, fatal);
    }
  }, {
    key: '_handleAddRAP',
    value: function _handleAddRAP(rap) {
      if (this.state.randomAccessPoints) {
        this.state.randomAccessPoints.push(rap);
      }
    }
  }, {
    key: '_onError',
    value: function _onError(type, mod, err, fatal) {
      var error = {
        errorType: type,
        errorDetails: '[' + mod + ']: ' + err.message,
        errorFatal: fatal || false
      };
      this._player.emit(FLV_ERROR, error);
    }
  }, {
    key: 'seek',
    value: function seek() {
      if (!this.state.initSegmentArrived) {
        this.loadData();
      }
    }
  }, {
    key: 'loadData',
    value: function loadData() {
      var url = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._player.config.url;

      this.emit(LOADER_EVENTS.LADER_START, url);
    }
  }, {
    key: 'pause',
    value: function pause() {
      var loader = this._context.getInstance('FETCH_LOADER');

      if (loader) {
        loader.cancel();
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this._player = null;
      this.state.randomAccessPoints = [];
    }
  }]);

  return FlvController;
}();

export default FlvController;
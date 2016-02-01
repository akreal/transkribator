'use strict';

WaveSurfer.Silent = Object.create(WaveSurfer.WebAudio);

WaveSurfer.util.extend(WaveSurfer.Silent, {
    init: function (params) {
        this.params = params;
		this.duration = 0;
		this.peaks = [];
    },

    loadMeta: function (url) {
        var my = this;

        var ajax = WaveSurfer.util.ajax({ url: url });

        ajax.on('success', function(data) {
			my.duration = data.wav2json.duration;

			my.peaks = [];

			for (var i = 0; i < data.wav2json.left.length; i++) {
				my.peaks.push(data.wav2json.left[i]);
			}

			my.fireEvent('ready');
		});
        ajax.on('error', function (e) {
            my.fireEvent('error', 'XHR error: ' + e.target.statusText);
        });

        return ajax;
    },

    isPaused: function () {
    },

    getDuration: function () {
        return this.duration;
    },

    getCurrentTime: function () {
        return 0;
    },

    getPlayedPercents: function () {
        return 0;
    },

    setPlaybackRate: function (value) {
    },

    seekTo: function (start) {
    },

    play: function (start, end) {
        this.fireEvent('play');
    },

    pause: function () {
        this.fireEvent('pause');
    },

    setPlayEnd: function (end) {
    },

    clearPlayEnd: function () {
    },

    getPeaks: function (length) {
        return this.peaks;
    },

    getVolume: function () {
		return 0;
    },

    setVolume: function (val) {
    },

    destroy: function () {
    }
});

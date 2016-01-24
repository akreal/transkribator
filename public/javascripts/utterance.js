'use strict';

var segment, segmentNumberById, segmentIdByNumber, pIndex, currentP, currentC, newCurrentC, sIndex, duration, transkription, dIndex, diIndex, originalTargetHTML, originalTargetClass, selectionDirection;

var changedColor = 'rgba(113, 212, 242, 0.4)';

var wavesurfer = Object.create(WaveSurfer);
var wavesurferSegment = Object.create(WaveSurfer);

var transkriptions = new Array();

var segmentNumberById = new Array();
var segmentIdByNumber = new Array();

var drops = new Array();

function loadUtterance() {
	if (wavesurferSegment.backend) {
		wavesurferSegment.destroy();
	}

    var options = {
        container     : document.querySelector('#waveform-segment'),
        waveColor     : 'violet',
        progressColor : 'purple',
        loaderColor   : 'purple',
        cursorColor   : '#b5b5b5',
        markerWidth   : 1,
        minPxPerSec   : 200,
        scrollParent  : true,
		normalize     : true,
    };

    /* Progress bar */
    var progressDiv = document.querySelector('#progress-bar-segment');
    var progressBar = progressDiv.querySelector('.progress-bar');
    wavesurferSegment.on('loading', function (percent, xhr) {
        progressDiv.style.display = 'block';
        progressBar.style.width = percent + '%';
    });
    wavesurferSegment.on('ready', function () {
        progressDiv.style.display = 'none';
		document.querySelector('#waveform-segment').style.display = 'block';
		loadTranskription();
    });
    wavesurferSegment.on('destroy', function () {
        progressDiv.style.display = 'none';
    });

	wavesurferSegment.on('error', function (err) { console.error(err); });
	wavesurferSegment.on('audioprocess', updateProgress);
	wavesurferSegment.on('seek', updateProgressSeek);

    // Init
    wavesurferSegment.init(options);
	document.querySelector('wave').style['overflowX'] = 'hidden';

    // Load audio from URL
	wavesurferSegment.load('/transcriptions/' + id.value + '?segment=' + segment + '&type=audio');
}


function updateProgress(e) {
	var activeP = pIndex[Math.floor(e * 100)];

	if (activeP == undefined) {
		activeP = dIndex[transkription.length - 1];
	}

	pActivate(activeP);
}

function updateProgressSeek(e) {
	updateProgress(e * wavesurferSegment.getDuration());
}

function pActivate(pId) {
	if (currentP != pId) {
		if (currentP != undefined) {
			pDeactivate(currentP);
		}
		if (drops[pId] != undefined) {
			drops[pId].target.parentNode.parentNode.classList.add('highlight');
			originalTargetHTML = drops[pId].target.innerHTML;
			originalTargetClass = drops[pId].target.getAttribute('phonem-class');
			drops[pId].open();
			setTimeout(function(){ drops[currentP].position() }, 10);
		}

		currentP = pId;
	}
}

function pDeactivate(pId) {
	drops[pId].target.parentNode.parentNode.classList.remove('highlight');

	drops[pId].close();

	var candidates = drops[pId].content.childNodes[0].childNodes;
	for (var i = 0; i < candidates.length; i++) {
		candidates[i].classList.remove('highlight');
	}

	currentC = undefined;
	originalTargetHTML = undefined;
}

function invertArray (input) {
	var output = new Array();

	for (var i = 0; i < input.length; i++) {
		output[input[i]] = i;
	}

	return output;
}


function exitCandidates() {
	if (drops[currentP] != undefined && originalTargetHTML != undefined) {
		drops[currentP].target.innerHTML = originalTargetHTML;
		drops[currentP].target.classList.remove('B','E','I','S','L');
		drops[currentP].target.classList.add(originalTargetClass);
	}
	drops.forEach(function(drop) {drop.close();});
	currentC = undefined;
}

// Bind buttons and keypresses
function createListeners () {
    var eventHandlers = {
        'play': function () {
            wavesurferSegment.playPause();
        },

        'back': function (e) {
			if (wavesurferSegment.backend.isPaused()) {
				if (currentC == undefined || drops[currentP] == undefined) {
					if (e.shiftKey) {
						var selection = wavesurferSegment.getSelection();

						if (selection != undefined &&
							wavesurferSegment.getCurrentTime() >= selection.startPosition &&
							wavesurferSegment.getCurrentTime() <= selection.endPosition
						) {
							if (selectionDirection == 'right') {
								if (pIndex[Math.floor(selection.startPosition * 100)] == pIndex[Math.floor(selection.endPosition * 100)]) {
									wavesurferSegment.seekAndCenter(selection.startPercentage);
									selection = undefined;
									selectionDirection = '';
								}
								else {
									selection.endPercentage = ((sIndex[pIndex[Math.floor(selection.endPosition * 100) + 1] - 1] || duration) - 1) / duration;
								}
							}
							else {
								selection.startPercentage = (sIndex[pIndex[Math.floor(selection.startPosition * 100) + 1] - 1] || 0) / duration;
								wavesurferSegment.seekAndCenter(selection.startPercentage + 1 / duration);
							}
						}
						else {
							selection = {
								startPercentage: (sIndex[diIndex[currentP] - 1] || 0) / duration,
								endPercentage: (sIndex[diIndex[currentP]] - 1) / duration
							};
							wavesurferSegment.seekAndCenter(selection.startPercentage + 1 / duration);
							selectionDirection = 'left';
						}

						if (selection) {
							wavesurferSegment.updateSelection(selection);
						}
						else {
							wavesurferSegment.clearSelection();
						}
					}
					else {
						if (diIndex[currentP] != 0) {
							wavesurferSegment.seekAndCenter( sIndex[diIndex[currentP] - 1] * 1.002 / duration );
						}
					}
				}
				else {
					var candidates = drops[currentP].content.childNodes[0].childNodes;
					newCurrentC = currentC == 0 ? candidates.length - 1 : currentC - 1;
					candidates[currentC].classList.remove('highlight');
					candidates[newCurrentC].classList.add('highlight');
					drops[currentP].target.innerHTML = drops[currentP].content.childNodes[0].childNodes[newCurrentC].innerHTML;
					drops[currentP].target.classList.remove('B','E','I','S','L');
					drops[currentP].target.classList.add(drops[currentP].content.childNodes[0].childNodes[newCurrentC].getAttribute('phonem-class'));
					currentC = newCurrentC;
				}
			}
			else {
				wavesurferSegment.pause();
			}
        },

		'forth': function (e) {
			if (currentC == undefined || drops[currentP] == undefined) {
				if (e.shiftKey) {
					var selection = wavesurferSegment.getSelection();

					if (selection != undefined &&
						wavesurferSegment.getCurrentTime() >= selection.startPosition &&
						wavesurferSegment.getCurrentTime() <= selection.endPosition
					) {
						if (selectionDirection == 'right') {
							selection.endPercentage = ((sIndex[pIndex[Math.floor(selection.endPosition * 100) + 1] + 1] || duration) - 1) / duration;
						}
						else {
							if (pIndex[Math.floor(selection.startPosition * 100)] == pIndex[Math.floor(selection.endPosition * 100)]) {
								wavesurferSegment.seekAndCenter( (sIndex[pIndex[Math.floor(selection.endPosition * 100)] + 1] * 1.002 || duration) / duration );
								selection = undefined;
								selectionDirection = '';
							}
							else {
								selection.startPercentage = (sIndex[pIndex[Math.floor(selection.startPosition * 100) + 1] + 1] * 1.002 || duration) / duration;
								wavesurferSegment.seekAndCenter(selection.startPercentage);
							}
						}
					}
					else {
						selection = {
							startPercentage: sIndex[diIndex[currentP]] / duration,
							endPercentage: ((sIndex[diIndex[currentP] + 1] || duration) - 1) / duration
						};
						selectionDirection = 'right';
					}

					if (selection) {
						wavesurferSegment.updateSelection(selection);
					}
					else {
						wavesurferSegment.clearSelection();
					}
				}
				else {
					if (diIndex[currentP] != transkription.length - 1) {
						wavesurferSegment.seekAndCenter( sIndex[diIndex[currentP] + 1] * 1.001 / duration );
					}
				}
			}
			else {
				var candidates = drops[currentP].content.childNodes[0].childNodes;
				newCurrentC = currentC == candidates.length - 1 ? 0 : currentC + 1;
				candidates[currentC].classList.remove('highlight');
				candidates[newCurrentC].classList.add('highlight');
				drops[currentP].target.innerHTML = drops[currentP].content.childNodes[0].childNodes[newCurrentC].innerHTML;
				drops[currentP].target.classList.remove('B','E','I','S','L');
				drops[currentP].target.classList.add(drops[currentP].content.childNodes[0].childNodes[newCurrentC].getAttribute('phonem-class'));
				currentC = newCurrentC;
			}
		},

        'escape': function () {
			exitCandidates();
        },

		'home': function () {
			wavesurferSegment.seekAndCenter(0);
		},

		'end': function () {
			wavesurferSegment.seekAndCenter( sIndex[sIndex.length - 1] * 1.002 / duration );
		},

		'pageup': function () {
			selectRegion(wavesurfer.regions.list[segmentIdByNumber[segmentNumberById[segment] + 1]]);
		},

		'pagedown': function () {
			selectRegion(wavesurfer.regions.list[segmentIdByNumber[segmentNumberById[segment] - 1]]);
		},

        'down': function () {
            if (drops[currentP] != undefined) {
				if (!drops[currentP].isOpened()) {
					drops[currentP].open();
				}
				if (currentC == undefined && drops[currentP].content.childNodes[0].childNodes.length > 0) {
					currentC = 0;
					drops[currentP].content.childNodes[0].childNodes[currentC].classList.add('highlight');
				}
			}

        },

        'enter': function () {
            if (currentC != undefined && drops[currentP] != undefined) {
				drops[currentP].content.childNodes[0].childNodes[currentC].click();
				currentC = undefined;
			}
		},

        'del': function () {
            if (drops[currentP] != undefined) {
				var index2del = diIndex[currentP];

				if (index2del == transkription.length - 1) {
					transkription.splice(index2del - 1, 2, [transkription[index2del - 1][0], transkription[index2del - 1][1] + transkription[index2del][1]]);
				}
				else {
					transkription.splice(index2del, 2, [transkription[index2del + 1][0], transkription[index2del][1] + transkription[index2del + 1][1]]);
				}

				pActivate(drops.length - 1);
			}
        },

        'backspace': function () {
			var index2del = diIndex[currentP] - 1;
            if (drops[currentP] != undefined && index2del != -1) {
				transkription.splice(index2del, 2, [transkription[index2del + 1][0], transkription[index2del][1] + transkription[index2del + 1][1]]);
				wavesurferSegment.seekAndCenter( sIndex[index2del] * 1.002 / duration );
			}
        },

		'ins': function () {
			if (drops[currentP] != undefined) {
				var index = diIndex[currentP];
				var newLength = transkription[index][1] / 2;

				$('.phones-modal').modal('show');
				$('.phones-modal').off('hidden.bs.modal');
				$('.phones-modal').on('hidden.bs.modal',
					function (e) {
						if (phoneFromModal) {
									transkription.splice(index, 1,
										[phoneFromModal, Math.ceil(newLength)],
										[transkription[index][0], Math.floor(newLength)]);
									pActivate(drops.length - 2);
						}
					}
				);

			}
		}
    };

    document.addEventListener('keydown', function (e) {
        var map = {
             8: 'backspace',// backspace
            13: 'enter',	// enter
            27: 'escape',	// escape
            32: 'play',		// space
            33: 'pageup',	// pageup
            34: 'pagedown',	// pagedown
            35: 'end',		// end
            36: 'home',		// home
            37: 'back',		// left
            38: 'enter',	// up
            39: 'forth',	// right
            40: 'down',		// down
            45: 'ins',		// insert
            46: 'del',		// delete
        };
        if (e.keyCode in map && !$('.phones-modal')[0].classList.contains('in')) {
		    var handler = eventHandlers[map[e.keyCode]];
            e.preventDefault();
            handler && handler(e);
        }
    });

    document.addEventListener('click', function (e) {
        var action = e.target.dataset && e.target.dataset.action;
        if (action && action in eventHandlers) {
            eventHandlers[action](e);
        }
    });
}

function changeBest(id, newBest) {
	drops[id].close();
	var phonemIndex = diIndex[id];
	transkription.splice(phonemIndex, 1, [newBest, transkription[phonemIndex][1]]);
	if (id == currentP) {
		pActivate(drops.length - 1);
	}
}

function changeBestModal(id) {
	$('.phones-modal').modal('show');
	$('.phones-modal').off('hidden.bs.modal');
	$('.phones-modal').on('hidden.bs.modal', function (e) { if (phoneFromModal) { changeBest(id, phoneFromModal) } else { exitCandidates() } });
}

function generateCandidatesList(id, phonemCode) {
	var candidatesList = document.createElement('div');
	candidatesList.className = 'candidates-list';

	if (editable) {
		var phonem = phones[_f(phones,phonemCode)];

		if (phonem.alternatives.length > 0) {
			var alternative = phonem;
			var candidate = document.createElement('span');

			candidate.classList.add('phone', 'candidate');
			candidate.setAttribute('phonem-class', alternative.pseudo.substr(-1, 1));
			candidate.classList.add(candidate.getAttribute('phonem-class'));
			candidate.innerHTML = alternative.ipa;
			eval('candidate.onclick = function () { changeBest(' + id + ', ' + alternative.id + '); };');

			candidatesList.appendChild(candidate);
		}

		for (var j = 0; j < phonem.alternatives.length; j++) {
			var alternative = phones[_f(phones,phonem.alternatives[j])];
			var candidate = document.createElement('span');

			candidate.classList.add('phone', 'candidate');
			candidate.setAttribute('phonem-class', alternative.pseudo.substr(-1, 1));
			candidate.classList.add(candidate.getAttribute('phonem-class'));
			candidate.innerHTML = alternative.ipa;
			eval('candidate.onclick = function () { changeBest(' + id + ', ' + alternative.id + '); };');

			candidatesList.appendChild(candidate);
		}

		var candidate = document.createElement('span');

		candidate.classList.add('phone', 'candidate');
		candidate.innerHTML = '&hellip;';
		eval('candidate.onclick = function () { changeBestModal(' + id + '); };');

		candidatesList.appendChild(candidate);
	}

	return candidatesList;
}

can.view.tag('phone', function(el, tagData){
	var i = drops.length;
	var phonemCode = tagData.scope.attr('0');
	var phonem = phones[_f(phones,phonemCode)];

	var best = document.createElement('div');
	best.classList.add('phone', 'best');
	best.setAttribute('phonem-class', phonem.pseudo.substr(-1, 1));
	best.classList.add(best.getAttribute('phonem-class'));
	best.innerHTML = phonem.ipa;

	drops.push(new Drop({
				target: best,
				content: generateCandidatesList(i, phonemCode),
				position: "bottom center" 
				})
			);

	$(el).html(best);
});

function loadTranskription() {
	duration = wavesurferSegment.getDuration() * 100;
	pIndex = new Array(Math.ceil(duration));
	diIndex = new Array();
	dIndex = new Array();
	currentP = undefined;
	document.querySelector('#phones').scrollLeft = 0;

	var drop;

	while (drop = drops.shift()) {
		drop.remove();
	}

	// Init Spectrogram plugin
	//var spectrogram = Object.create(WaveSurfer.Spectrogram);

	//spectrogram.init({
	//	wavesurferSegment: wavesurferSegment,
	//	container: '#wave-spectrogram',
	//	fftSamples: 512
	//});

	if (transkriptions[segment]) {
		renderTranskription(transkriptions[segment]);
	}
	else {
		var xhr = new XMLHttpRequest();
		xhr.overrideMimeType('application/json');
		xhr.open('GET', '/transcriptions/' + id.value + '?segment=' + segment + '&type=transkription', true);
		xhr.send();

		xhr.addEventListener('load', function (e) {
			if (200 == xhr.status) {
				renderTranskription(JSON.parse(xhr.responseText));
			}
			else {
				wavesurferSegment.fireEvent('error', 'Server response: ' + xhr.statusText);
			}
		});
	}
}

function renderTranskription(data) {
	transkription = new can.List(data);

	var phonemStart = 0;
	sIndex = new Array(transkription.length);

	for (var i = 0; i < transkription.length; i++) {
		diIndex[i] = i;
		dIndex[i] = i;
		sIndex[i] = phonemStart;

		for (var j = 0; j < transkription[i][1]; j++) {
			pIndex[phonemStart + j] = i;
		}

		phonemStart += transkription[i][1];
	}

	transkription.bind('remove', function(ev, n, index) {
		for (var i = 0; i < n.length; i++) {
			dIndex.splice(index, 1);
			sIndex.splice(index, 1);
		}

		diIndex = invertArray(dIndex);
		transkriptions[segment] = transkription.attr();
		wavesurfer.regions.list[segment].element.style.backgroundColor =
						wavesurfer.regions.list[segment].color = changedColor;
	});

	transkription.bind('add', function(ev, n, index) {
		var phonemStart = index > 0 ? sIndex[index - 1] + transkription[index - 1][1] : 0;

		for (var i = 0; i < n.length; i++) {
			var newId = drops.length + i;
			dIndex.splice(index + i, 0, newId);
			sIndex.splice(index + i, 0, phonemStart);

			for (var j = 0; j < n[i][1]; j++) {
				pIndex[phonemStart + j] = newId;
			}

			phonemStart += n[i][1];
		}

		diIndex = invertArray(dIndex);
		transkriptions[segment] = transkription.attr();
		wavesurfer.regions.list[segment].element.style.backgroundColor =
						wavesurfer.regions.list[segment].color = changedColor;
	});

	var phonesView = can.view(
				'phones-template',
				{ transkription: transkription },
				{ width:  function() {
					return (
							wavesurferSegment.drawer.wrapper.scrollWidth /
							wavesurferSegment.getDuration()
							) / 100 * this[1];
				} }
	);

	$('#phones').html(phonesView);

	document.querySelector('#waveform-segment').childNodes[3].addEventListener('scroll', function(e) {
		document.querySelector('#phones').scrollLeft = document.querySelector('#waveform-segment').childNodes[3].scrollLeft;
	})

	wavesurferSegment.seekAndCenter(0);

}

function checkProgress() {
	var xhr = new XMLHttpRequest();
	xhr.overrideMimeType('application/json');
	xhr.open('GET', '/transcriptions/' + id.value + '?type=progress', true);
	xhr.send();

	xhr.addEventListener('load', function (e) {
		if (200 == xhr.status) {
			var percent = JSON.parse(xhr.responseText)['percent'];
			if (percent == 100) {

				document.querySelector('#transkribing-progress-bar').style.display = 'none';

			    /* Progress bar */
			    var progressDiv = document.querySelector('#progress-bar');
			    var progressBar = progressDiv.querySelector('.progress-bar');
			    wavesurfer.on('loading', function (percent, xhr) {
			        progressDiv.style.display = 'block';
			        progressBar.style.width = percent + '%';
			    });
			    wavesurfer.on('ready', function () {
			        progressDiv.style.display = 'none';
			    });
			    wavesurfer.on('destroy', function () {
			        progressDiv.style.display = 'none';
			    });

			    // Init
			    var options = {
			        container     : document.querySelector('#waveform'),
			        waveColor     : 'violet',
					progressColor : 'violet',
			        cursorWidth   : 0,
			        scrollParent  : false,
					normalize     : true,
					height        : 48,
			    };
				options.container.style.display = 'block';

			    wavesurfer.init(options);

				document.querySelector('wave').style['overflowX'] = 'hidden';

				var wave2 = wavesurfer.container.lastChild;
				var wave1 = wave2.previousSibling;
				wave1.parentElement.replaceChild(wave1, wave2);
				wave1.parentElement.insertBefore(wave2, wave1);

			    // Load audio from URL
				wavesurfer.load('/transcriptions/' + id.value + '?type=audio');
			}
			else {
				document.querySelector('#transkribing-progress-bar').innerText = 'Transcribing is about ' + percent + '% done...';
				setTimeout(checkProgress, 3000);
			}
		}
	});
}

createListeners();

document.addEventListener('DOMContentLoaded', checkProgress);

wavesurfer.on('region-mouseenter', highlightRegion);
wavesurfer.on('region-mouseleave', dehighlightRegion);
wavesurfer.on('region-click', selectRegion);

wavesurfer.on('error', function (err) { console.error(err); });

wavesurfer.on('ready', function () {
	wavesurfer.util.ajax({
		responseType: 'json',
		url: '/transcriptions/' + id.value + '?type=segments'
	}).on('success', createRegions);

	var timeline = Object.create(WaveSurfer.Timeline);

	timeline.init({
			wavesurfer: wavesurfer,
			container: "#wave-timeline"
	});

	document.forms[0].onsubmit = function() {
									if (transkriptions.length > 0) {
										document.forms[0].transkriptions.value = JSON.stringify(transkriptions);
									}
								};
});

function createRegions(segments) {
	for (var i = 0; i < segments.length; i++) {
		wavesurfer.addRegion({
								'start'	: segments[i].start / 100.0,
								'end'	: (segments[i].start + segments[i].duration) / 100.0,
								'resize': false,
								'drag'	: false,
								'id'	: segments[i].id,
								'color'	: 'rgba(40, 40, 40, 0.1)'
							});
		segmentNumberById[segments[i].id] = i;
		segmentIdByNumber[i] = segments[i].id;
	}

	selectRegion(wavesurfer.regions.list[segments[0].id]);
}

function highlightRegion(region, e) {
	if (!segment || region.id != segment) {
		region.element.style.backgroundColor = 'rgba(83, 83, 255, 0.1)';
	}
}

function dehighlightRegion(region, e) {
	if (!segment || region.id != segment) {
		region.element.style.backgroundColor = region.color;
	}
}

function selectRegion(region, e) {
	if (region) {
		if (segment) {
			wavesurfer.regions.list[segment].element.style.backgroundColor = wavesurfer.regions.list[segment].color;
		}
		region.element.style.backgroundColor = 'rgba(110, 110, 255, 0.2)';

		if (! transkriptions[region.id]) {
			wavesurfer.regions.list[region.id].color = 'rgba(200, 200, 200, 0.1)';
		}

		segment = region.id;
		loadUtterance();
	}
}


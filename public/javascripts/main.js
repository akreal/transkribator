'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    var options = {
        container     : document.querySelector('#waveform'),
        waveColor     : 'violet',
        progressColor : 'purple',
        loaderColor   : 'purple',
        cursorColor   : '#b5b5b5',
        markerWidth   : 1,
        minPxPerSec   : 400,
        scrollParent  : true,
		normalize     : true,
    };

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
    wavesurfer.init(options);

	document.querySelector('wave').style['overflowX'] = 'hidden';

    // Load audio from URL
	wavesurfer.load('/transcriptions/' + utt.value + '?type=audio');
});

var drops = new Array();

var pIndex, currentP, currentC, newCurrentC, sIndex, duration, transkription, dIndex, diIndex, transkriptionChanged, originalTargetHTML, originalTargetClass;

function pActivate (pId) {
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

function pDeactivate (pId) {
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
(function () {
    var eventHandlers = {
        'play': function () {
            wavesurfer.playPause();
        },

        'back': function () {
			if (wavesurfer.backend.isPaused()) {
				if (currentC == undefined || drops[currentP] == undefined) {
					if (diIndex[currentP] != 0) {
						wavesurfer.seekAndCenter( sIndex[diIndex[currentP] - 1] * 1.002 / duration );
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
				wavesurfer.pause();
			}
        },

		'forth': function () {
			if (currentC == undefined || drops[currentP] == undefined) {
				if (diIndex[currentP] != transkription.length - 1) {
					wavesurfer.seekAndCenter( sIndex[diIndex[currentP] + 1] * 1.002 / duration );
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

		'ins': function () {
			if (drops[currentP] != undefined) {
				var index = diIndex[currentP];
				var newLength = transkription[index][1] / 2;

				phoneFromModal = null;
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
            13: 'enter',	// enter
            27: 'escape',	// escape
            32: 'play',		// space
            37: 'back',		// left
            38: 'enter',	// up
            39: 'forth',	// right
            40: 'down',		// right
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
}());

wavesurfer.on('error', function (err) {
    console.error(err);
});

wavesurfer.on('progress', function (e) {
	pActivate(pIndex[Math.floor(wavesurfer.getCurrentTime() * 100)]);
});

var transkription;

function changeBest(id, newBest) {
	drops[id].close();
	var phonemIndex = diIndex[id];
	transkription.splice(phonemIndex, 1, [newBest, transkription[phonemIndex][1]]);
	if (id == currentP) {
		pActivate(drops.length - 1);
	}
}

function changeBestModal(id) {
	phoneFromModal = null;
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


wavesurfer.on('ready', function () {
	duration = wavesurfer.getDuration() * 100;
	pIndex = new Array(Math.ceil(duration));
	diIndex = new Array();
	dIndex = new Array();

	// Init Spectrogram plugin
	//var spectrogram = Object.create(WaveSurfer.Spectrogram);

	//document.querySelector('#wave-spectrogram').removeChild(document.querySelector('#wave-spectrogram').childNodes[0]);

	//spectrogram.init({
	//	wavesurfer: wavesurfer,
	//	container: '#wave-spectrogram',
	//	fftSamples: 512
	//});

	var xhr = new XMLHttpRequest();
	xhr.overrideMimeType('application/json');
	xhr.open('GET', '/transcriptions/' + utt.value + '?type=json', true);
	xhr.send();

	xhr.addEventListener('load', function (e) {
		if (200 == xhr.status) {
			transkription = new can.List(JSON.parse(xhr.responseText));

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
				transkriptionChanged = true;
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
				transkriptionChanged = true;
			});

			var phones = can.view(
						'phones-template',
						{ transkription: transkription },
						{ width:  function() { return wavesurfer.params.minPxPerSec / 100 * this[1] } }
			);

			$('#phones').html(phones);

			document.querySelector('#waveform').childNodes[5].addEventListener('scroll', function(e) {
				document.querySelector('#phones').scrollLeft = document.querySelector('#waveform').childNodes[5].scrollLeft;
			})

			wavesurfer.seekAndCenter(0);

			document.forms[0].onsubmit = function() { 
													if (transkriptionChanged) {
														document.forms[0].transkription.value = JSON.stringify(transkription.attr());
													} 
										};
		}
		else {
			wavesurfer.fireEvent('error', 'Server response: ' + xhr.statusText);
		}
	});
});

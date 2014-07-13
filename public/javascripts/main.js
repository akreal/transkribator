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
        cursorColor   : 'navy',
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

var pIndex, currentP, currentC, newCurrentC, sIndex, duration, transkription, dIndex, diIndex;

function pActivate (pId) {
	if (currentP != pId) {
		if (currentP != undefined) {
			pDeactivate(currentP);
		}
		if (drops[pId] != undefined) {
			drops[pId].target.parentNode.parentNode.classList.add('highlight');
			drops[pId].open();
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
					if (currentP != 0) {
						wavesurfer.seekAndCenter( (sIndex[dIndex[(diIndex[currentP] || transkription.length) - 1]] * 1.002) / duration );
					}
				}
				else {
					var candidates = drops[currentP].content.childNodes[0].childNodes;
					newCurrentC = currentC == 0 ? candidates.length - 1 : currentC - 1;
					candidates[currentC].classList.remove('highlight');
					candidates[newCurrentC].classList.add('highlight');
					drops[currentP].target.innerHTML = drops[currentP].content.childNodes[0].childNodes[newCurrentC].innerHTML;
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
					wavesurfer.seekAndCenter( (sIndex[dIndex[(diIndex[currentP] + 1) || 1]] * 1.002) / duration );
				}
			}
			else {
				var candidates = drops[currentP].content.childNodes[0].childNodes;
				newCurrentC = currentC == candidates.length - 1 ? 0 : currentC + 1;
				candidates[currentC].classList.remove('highlight');
				candidates[newCurrentC].classList.add('highlight');
				drops[currentP].target.innerHTML = drops[currentP].content.childNodes[0].childNodes[newCurrentC].innerHTML;
				currentC = newCurrentC;
			}
        },

        'escape': function () {
			drops.forEach(function(drop) {drop.close();});
			currentC = undefined;
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
        }
    };

    document.addEventListener('keydown', function (e) {
        var map = {
            13: 'enter',      // enter
            27: 'escape',     // escape
            32: 'play',       // space
            37: 'back',       // left
            38: 'enter',     // up
            39: 'forth',      // right
            40: 'down',      // right
        };
        if (e.keyCode in map) {
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

var phonemHTML = Array();

phonemHTML[1] = 'Silence'; //SIL
phonemHTML[2] = 'Silence'; //SIL_B
phonemHTML[3] = 'Silence'; //SIL_E
phonemHTML[4] = 'Silence'; //SIL_I
phonemHTML[5] = 'Silence'; //SIL_S
phonemHTML[6] = '&#x6F;'; //AA_B
phonemHTML[7] = '&#x6F;'; //AA_E
phonemHTML[8] = '&#x6F;'; //AA_I
phonemHTML[9] = '&#x6F;'; //AA_S
phonemHTML[10] = '&#xE6;'; //AE_B
phonemHTML[11] = '&#xE6;'; //AE_E
phonemHTML[12] = '&#xE6;'; //AE_I
phonemHTML[13] = '&#xE6;'; //AE_S
phonemHTML[14] = '&#x28C;'; //AH_B
phonemHTML[15] = '&#x28C;'; //AH_E
phonemHTML[16] = '&#x28C;'; //AH_I
phonemHTML[17] = '&#x28C;'; //AH_S
phonemHTML[18] = '&#x6F;&#x302;'; //AO_B
phonemHTML[19] = '&#x6F;&#x302;'; //AO_E
phonemHTML[20] = '&#x6F;&#x302;'; //AO_I
phonemHTML[21] = '&#x6F;&#x302;'; //AO_S
phonemHTML[22] = '&#x6F;&#x75;'; //AW_B
phonemHTML[23] = '&#x6F;&#x75;'; //AW_E
phonemHTML[24] = '&#x6F;&#x75;'; //AW_I
phonemHTML[25] = '&#x6F;&#x75;'; //AW_S
phonemHTML[26] = '&#x251;&#x69;'; //AY_B
phonemHTML[27] = '&#x251;&#x69;'; //AY_E
phonemHTML[28] = '&#x251;&#x69;'; //AY_I
phonemHTML[29] = '&#x251;&#x69;'; //AY_S
phonemHTML[30] = '&#x62;'; //B_B
phonemHTML[31] = '&#x62;'; //B_E
phonemHTML[32] = '&#x62;'; //B_I
phonemHTML[33] = '&#x62;'; //B_S
phonemHTML[34] = '&#x74;&#x283;'; //CH_B
phonemHTML[35] = '&#x74;&#x283;'; //CH_E
phonemHTML[36] = '&#x74;&#x283;'; //CH_I
phonemHTML[37] = '&#x74;&#x283;'; //CH_S
phonemHTML[38] = '&#x64;'; //D_B
phonemHTML[39] = '&#x64;'; //D_E
phonemHTML[40] = '&#x64;'; //D_I
phonemHTML[41] = '&#x64;'; //D_S
phonemHTML[42] = '&#xF0;'; //DH_B
phonemHTML[43] = '&#xF0;'; //DH_E
phonemHTML[44] = '&#xF0;'; //DH_I
phonemHTML[45] = '&#xF0;'; //DH_S
phonemHTML[46] = '&#x25B;'; //EH_B
phonemHTML[47] = '&#x25B;'; //EH_E
phonemHTML[48] = '&#x25B;'; //EH_I
phonemHTML[49] = '&#x25B;'; //EH_S
phonemHTML[50] = '&#x259;'; //ER_B
phonemHTML[51] = '&#x259;'; //ER_E
phonemHTML[52] = '&#x259;'; //ER_I
phonemHTML[53] = '&#x259;'; //ER_S
phonemHTML[54] = '&#x65;&#x26A;'; //EY_B
phonemHTML[55] = '&#x65;&#x26A;'; //EY_E
phonemHTML[56] = '&#x65;&#x26A;'; //EY_I
phonemHTML[57] = '&#x65;&#x26A;'; //EY_S
phonemHTML[58] = '&#x66;'; //F_B
phonemHTML[59] = '&#x66;'; //F_E
phonemHTML[60] = '&#x66;'; //F_I
phonemHTML[61] = '&#x66;'; //F_S
phonemHTML[62] = '&#x261;'; //G_B
phonemHTML[63] = '&#x261;'; //G_E
phonemHTML[64] = '&#x261;'; //G_I
phonemHTML[65] = '&#x261;'; //G_S
phonemHTML[66] = '&#x68;'; //HH_B
phonemHTML[67] = '&#x68;'; //HH_E
phonemHTML[68] = '&#x68;'; //HH_I
phonemHTML[69] = '&#x68;'; //HH_S
phonemHTML[70] = '&#x26A;'; //IH_B
phonemHTML[71] = '&#x26A;'; //IH_E
phonemHTML[72] = '&#x26A;'; //IH_I
phonemHTML[73] = '&#x26A;'; //IH_S
phonemHTML[74] = '&#x69;'; //IY_B
phonemHTML[75] = '&#x69;'; //IY_E
phonemHTML[76] = '&#x69;'; //IY_I
phonemHTML[77] = '&#x69;'; //IY_S
phonemHTML[78] = '&#x64;&#x292;'; //JH_B
phonemHTML[79] = '&#x64;&#x292;'; //JH_E
phonemHTML[80] = '&#x64;&#x292;'; //JH_I
phonemHTML[81] = '&#x64;&#x292;'; //JH_S
phonemHTML[82] = '&#x6B;'; //K_B
phonemHTML[83] = '&#x6B;'; //K_E
phonemHTML[84] = '&#x6B;'; //K_I
phonemHTML[85] = '&#x6B;'; //K_S
phonemHTML[86] = '&#x6C;'; //L_B
phonemHTML[87] = '&#x6C;'; //L_E
phonemHTML[88] = '&#x6C;'; //L_I
phonemHTML[89] = '&#x6C;'; //L_S
phonemHTML[90] = '&#x6D;'; //M_B
phonemHTML[91] = '&#x6D;'; //M_E
phonemHTML[92] = '&#x6D;'; //M_I
phonemHTML[93] = '&#x6D;'; //M_S
phonemHTML[94] = '&#x6E;'; //N_B
phonemHTML[95] = '&#x6E;'; //N_E
phonemHTML[96] = '&#x6E;'; //N_I
phonemHTML[97] = '&#x6E;'; //N_S
phonemHTML[98] = '&#x14B;'; //NG_B
phonemHTML[99] = '&#x14B;'; //NG_E
phonemHTML[100] = '&#x14B;'; //NG_I
phonemHTML[101] = '&#x14B;'; //NG_S
phonemHTML[102] = '&#x259;&#x28A;'; //OW_B
phonemHTML[103] = '&#x259;&#x28A;'; //OW_E
phonemHTML[104] = '&#x259;&#x28A;'; //OW_I
phonemHTML[105] = '&#x259;&#x28A;'; //OW_S
phonemHTML[106] = '&#x254;&#x26A;'; //OY_B
phonemHTML[107] = '&#x254;&#x26A;'; //OY_E
phonemHTML[108] = '&#x254;&#x26A;'; //OY_I
phonemHTML[109] = '&#x254;&#x26A;'; //OY_S
phonemHTML[110] = '&#x70;'; //P_B
phonemHTML[111] = '&#x70;'; //P_E
phonemHTML[112] = '&#x70;'; //P_I
phonemHTML[113] = '&#x70;'; //P_S
phonemHTML[114] = '&#x72;'; //R_B
phonemHTML[115] = '&#x72;'; //R_E
phonemHTML[116] = '&#x72;'; //R_I
phonemHTML[117] = '&#x72;'; //R_S
phonemHTML[118] = '&#x73;'; //S_B
phonemHTML[119] = '&#x73;'; //S_E
phonemHTML[120] = '&#x73;'; //S_I
phonemHTML[121] = '&#x73;'; //S_S
phonemHTML[122] = '&#x283;'; //SH_B
phonemHTML[123] = '&#x283;'; //SH_E
phonemHTML[124] = '&#x283;'; //SH_I
phonemHTML[125] = '&#x283;'; //SH_S
phonemHTML[126] = '&#x74;'; //T_B
phonemHTML[127] = '&#x74;'; //T_E
phonemHTML[128] = '&#x74;'; //T_I
phonemHTML[129] = '&#x74;'; //T_S
phonemHTML[130] = '&#x3B8;'; //TH_B
phonemHTML[131] = '&#x3B8;'; //TH_E
phonemHTML[132] = '&#x3B8;'; //TH_I
phonemHTML[133] = '&#x3B8;'; //TH_S
phonemHTML[134] = '&#x28A;'; //UH_B
phonemHTML[135] = '&#x28A;'; //UH_E
phonemHTML[136] = '&#x28A;'; //UH_I
phonemHTML[137] = '&#x28A;'; //UH_S
phonemHTML[138] = '&#x75;&#x2D0;'; //UW_B
phonemHTML[139] = '&#x75;&#x2D0;'; //UW_E
phonemHTML[140] = '&#x75;&#x2D0;'; //UW_I
phonemHTML[141] = '&#x75;&#x2D0;'; //UW_S
phonemHTML[142] = '&#x76;'; //V_B
phonemHTML[143] = '&#x76;'; //V_E
phonemHTML[144] = '&#x76;'; //V_I
phonemHTML[145] = '&#x76;'; //V_S
phonemHTML[146] = '&#x77;'; //W_B
phonemHTML[147] = '&#x77;'; //W_E
phonemHTML[148] = '&#x77;'; //W_I
phonemHTML[149] = '&#x77;'; //W_S
phonemHTML[150] = '&#x6A;'; //Y_B
phonemHTML[151] = '&#x6A;'; //Y_E
phonemHTML[152] = '&#x6A;'; //Y_I
phonemHTML[153] = '&#x6A;'; //Y_S
phonemHTML[154] = '&#x7A;'; //Z_B
phonemHTML[155] = '&#x7A;'; //Z_E
phonemHTML[156] = '&#x7A;'; //Z_I
phonemHTML[157] = '&#x7A;'; //Z_S
phonemHTML[158] = '&#x292;'; //ZH_B
phonemHTML[159] = '&#x292;'; //ZH_E
phonemHTML[160] = '&#x292;'; //ZH_I
phonemHTML[161] = '&#x292;'; //ZH_S

var alternatives = new Array();
alternatives[30] = [30,34,38,62,78,82,110,126];
alternatives[34] = [34,30,38,62,78,82,110,126];
alternatives[38] = [38,30,34,62,78,82,110,126];
alternatives[62] = [62,30,34,38,78,82,110,126];
alternatives[78] = [78,30,34,38,62,82,110,126];
alternatives[82] = [82,30,34,38,62,78,110,126];
alternatives[110] = [110,30,34,38,62,78,82,126];
alternatives[126] = [126,30,34,38,62,78,82,110];
alternatives[31] = [31,35,39,63,79,83,111,127];
alternatives[35] = [35,31,39,63,79,83,111,127];
alternatives[39] = [39,31,35,63,79,83,111,127];
alternatives[63] = [63,31,35,39,79,83,111,127];
alternatives[79] = [79,31,35,39,63,83,111,127];
alternatives[83] = [83,31,35,39,63,79,111,127];
alternatives[111] = [111,31,35,39,63,79,83,127];
alternatives[127] = [127,31,35,39,63,79,83,111];
alternatives[32] = [32,36,40,64,80,84,112,128];
alternatives[36] = [36,32,40,64,80,84,112,128];
alternatives[40] = [40,32,36,64,80,84,112,128];
alternatives[64] = [64,32,36,40,80,84,112,128];
alternatives[80] = [80,32,36,40,64,84,112,128];
alternatives[84] = [84,32,36,40,64,80,112,128];
alternatives[112] = [112,32,36,40,64,80,84,128];
alternatives[128] = [128,32,36,40,64,80,84,112];
alternatives[33] = [33,37,41,65,81,85,113,129];
alternatives[37] = [37,33,41,65,81,85,113,129];
alternatives[41] = [41,33,37,65,81,85,113,129];
alternatives[65] = [65,33,37,41,81,85,113,129];
alternatives[81] = [81,33,37,41,65,85,113,129];
alternatives[85] = [85,33,37,41,65,81,113,129];
alternatives[113] = [113,33,37,41,65,81,85,129];
alternatives[129] = [129,33,37,41,65,81,85,113];

for (var i = 0; i < phonemHTML.length; i++) {
	if (!alternatives[i]) {
		alternatives[i] = new Array();
	} 
}

var transkription;

function changeBest(id, newBest) {
	drops[id].close();
	var phonemIndex = diIndex[id];
	transkription.splice(phonemIndex, 1, [newBest, transkription[phonemIndex][1]]);
	pActivate(drops.length - 1);
}

function generateCandidatesList(id, phonemCode) {
	var candidatesList = document.createElement('div');
	candidatesList.className = 'candidates-list';

	for (var j = 0; j < alternatives[phonemCode].length; j++) {
		var candidate = document.createElement('span');

		candidate.className = 'candidate';
		candidate.innerHTML = phonemHTML[alternatives[phonemCode][j]];
		eval('candidate.onclick = function () { changeBest(' + id + ', ' + alternatives[phonemCode][j] + '); };');

		candidatesList.appendChild(candidate);
	}

	return candidatesList;
}

can.view.tag('phone', function(el, tagData){
	var i = drops.length;
	var phonemCode = tagData.scope.attr('0');

	var best = document.createElement('div');
	best.className = 'best';
	best.innerHTML = phonemHTML[phonemCode];

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

			transkription.bind('add', function(ev, n, index) {
				var phonemStart = index > 0 ? sIndex[index - 1] + transkription[index - 1][1] : 0;

				for (var i = 0; i < n.length; i++) {
					var newId = drops.length + i;
					diIndex[newId] = index + i;
					dIndex[index + i] = newId;
					sIndex[newId] = phonemStart;

					for (var j = 0; j < n[i][1]; j++) {
						pIndex[phonemStart + j] = newId;
					}

					phonemStart += n[i][1];
				}
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
		}
		else {
			wavesurfer.fireEvent('error', 'Server response: ' + xhr.statusText);
		}
	});
});

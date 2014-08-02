var phoneFromModal, curPhoneFromModal;

var modalContent = document.createElement('div');
modalContent.classList.add('modal-content');

for (var i = 1; i < phones.length; i++) {
	var phoneElement = document.createElement('a');
	phoneElement.classList.add('phone', 'btn', 'btn-default');
	phoneElement.classList.add(phones[i].pseudo.substr(-1, 1));
	eval('phoneElement.onclick = function () { phoneFromModal=' + phones[i].id + '; $(".phones-modal").modal("hide"); };');
	phoneElement.innerHTML = phones[i].ipa;
	phoneElement.id = 'p-' + i;
	modalContent.appendChild(phoneElement);

	if (i % 16 == 0) {
		 modalContent.appendChild(document.createElement('br'));
	}
}

var modalDialog = document.createElement('div');
modalDialog.classList.add('modal-dialog', 'modal-lg');
modalDialog.appendChild(modalContent);

var phonesModal = document.createElement('div');
phonesModal.classList.add('modal', 'fade', 'phones-modal');
phonesModal.setAttribute('tabindex', '-1');
phonesModal.setAttribute('role', 'dialog');
phonesModal.setAttribute('aria-labelledby', 'phonesModalLabel');
phonesModal.setAttribute('aria-hidden', 'true');
phonesModal.appendChild(modalDialog);

document.body.appendChild(phonesModal);

function updateModalView() {
	$('a.btn.phone').removeClass('active');
	$('#p-' + curPhoneFromModal).addClass('active');
}

var eventHandlers = {
		'enter': function () {
			$('#p-' + curPhoneFromModal).trigger('click');
		},

		'left': function () {
			if (curPhoneFromModal > 1) {
				curPhoneFromModal--;
				updateModalView();
			}
		},

		'right': function () {
			if (curPhoneFromModal < phones.length - 1) {
				curPhoneFromModal++;
				updateModalView();
			}
		},

		'up': function () {
			if (curPhoneFromModal > 16) {
				curPhoneFromModal -= 16;
				updateModalView();
			}
		},

		'down': function () {
			if (curPhoneFromModal < phones.length - 16) {
				curPhoneFromModal += 16;
				updateModalView();
			}
		}
};

document.addEventListener('keydown', function (e) {
	var map = {
		13: 'enter',	// enter
		37: 'left',		// left
		38: 'up',		// up
		39: 'right',	// right
		40: 'down',		// down
	};
	if (e.keyCode in map && $('.phones-modal')[0].classList.contains('in')) {
		var handler = eventHandlers[map[e.keyCode]];
		e.preventDefault();
		handler && handler(e);
	}
});

$('.phones-modal').on('show.bs.modal', function () { phoneFromModal = undefined; curPhoneFromModal = 1; updateModalView(); });


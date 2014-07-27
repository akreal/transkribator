var phoneFromModal;

var modalContent = document.createElement('div');
modalContent.classList.add('modal-content');

for (var i = 1; i < phones.length; i++) {
	var phoneElement = document.createElement('a');
	phoneElement.classList.add('phone', 'btn', 'btn-default');
	phoneElement.classList.add(phones[i].pseudo.substr(-1, 1));
	eval('phoneElement.onclick = function () { phoneFromModal=' + phones[i].id + '; $(".phones-modal").modal("hide"); };');
	phoneElement.innerHTML = phones[i].ipa;
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


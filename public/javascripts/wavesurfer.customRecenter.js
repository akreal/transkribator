WaveSurfer.Drawer.recenterOnPosition = function (position, immediate) {
	var scrollLeft = this.wrapper.scrollLeft;
	var clientWidth = this.wrapper.clientWidth;
	var maxScroll = this.wrapper.scrollWidth - clientWidth;

	if (maxScroll == 0) {
		// no need to continue if scrollbar is not there
		return;
	}

	var border = ~~( clientWidth * 0.05 );
	var target = scrollLeft;
	if (position - scrollLeft > clientWidth - border) {
		target = position - border;
	}
	if (position - scrollLeft < border) {
		target = position - clientWidth + border;
	}

	// limit target to valid range (0 to maxScroll)
	target = Math.max(0, Math.min(maxScroll, target));
	if (target != scrollLeft) {
		this.wrapper.scrollLeft = target;
	}

};

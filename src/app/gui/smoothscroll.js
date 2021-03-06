/*!
 * Smoothscroll
 * https://github.com/galambalazs/smoothscroll
 * Slightly modified
 */
define(function() {

	return function() {
		// SmoothScroll v1.2.1
		// Licensed under the terms of the MIT license.

		// People involved
		//  - Balazs Galambosi (maintainer)
		//  - Patrick Brunner  (original idea)
		//  - Michael Herf     (Pulse Algorithm)

		// Scroll Variables (tweakable)
		var defaultOptions = {

			// Scrolling Core
			frameRate        : 60, // [Hz]
			animationTime    : 400, // [px]
			stepSize         : 120, // [px]

			// Pulse (less tweakable)
			// ratio of "tail" to "acceleration"
			pulseAlgorithm   : true,
			pulseScale       : 4,
			pulseNormalize   : 1,

			// Acceleration
			accelerationDelta : 20,  // 20
			accelerationMax   : 1,   // 1

			// Keyboard Settings
			keyboardSupport   : true,  // option
			arrowScroll       : 50,     // [px]

			// Other
			touchpadSupport   : true,
			fixedBackground   : true,
			excluded          : ""
		};

		var options = Object.create( defaultOptions );


		// Other Variables
		var isExcluded = false;
		var isFrame = false;
		var direction = { x: 0, y: 0 };
		var initDone  = false;
		var root = document.documentElement;
		var activeElement;
		var observer;
		var deltaBuffer = [ 120, 120, 120 ];

		var key = { left: 37, up: 38, right: 39, down: 40, spacebar: 32,
			pageup: 33, pagedown: 34, end: 35, home: 36 };


		/***********************************************
		 * INITIALIZE
		 ***********************************************/

		/**
		 * Tests if smooth scrolling is allowed. Shuts down everything if not.
		 */
		function initTest() {
			if (options.keyboardSupport) {
				addEvent("keydown", keydown);
			}
		}

		/**
		 * Sets up scrolls array, determines if frames are involved.
		 */
		function init() {

			if (!document.body || initDone) { return; }

			var body = document.body;
			var html = document.documentElement;
			var windowHeight = window.innerHeight;
			var scrollHeight = body.scrollHeight;

			// check compat mode for root element
			root = (document.compatMode.indexOf("CSS") >= 0) ? html : body;
			activeElement = body;

			initTest();
			initDone = true;

			// Checks if this script is running in a frame
			if (window.top !== window.self) {
				isFrame = true;
			}

			/**
			 * This fixes a bug where the areas left and right to
			 * the content does not trigger the onmousewheel event
			 * on some pages. e.g.: html, body { height: 100% }
			 */
			else if (scrollHeight > windowHeight &&
				(body.offsetHeight <= windowHeight ||
					html.offsetHeight <= windowHeight)) {

				// DOMChange (throttle): fix height
				var pending = false;
				var refresh = function () {
					if (!pending && html.scrollHeight !== document.height) {
						pending = true; // add a new pending action
						setTimeout(function () {
							html.style.height = document.height + "px";
							pending = false;
						}, 500); // act rarely to stay fast
					}
				};
				html.style.height = "auto";
				setTimeout(refresh, 10);

				var config = {
					attributes: true,
					childList: true,
					characterData: false
				};

				observer = new MutationObserver(refresh);
				observer.observe(body, config);

				// clearfix
				if (root.offsetHeight <= windowHeight) {
					var underlay = document.createElement("div");
					underlay.style.clear = "both";
					body.appendChild(underlay);
				}
			}

			// disable fixed background
			if (!options.fixedBackground && !isExcluded) {
				body.style.backgroundAttachment = "scroll";
				html.style.backgroundAttachment = "scroll";
			}
		}


		/************************************************
		 * SCROLLING
		 ************************************************/

		var que = [];
		var pending = false;
		var lastScroll = +new Date();

		/**
		 * Pushes scroll actions to the scrolling queue.
		 */
		function scrollArray(elem, left, top, delay) {

			delay = delay || 1000;
			directionCheck(left, top);

			if (options.accelerationMax !== 1) {
				var now = +new Date();
				var elapsed = now - lastScroll;
				if (elapsed < options.accelerationDelta) {
					var factor = (1 + (30 / elapsed)) / 2;
					if (factor > 1) {
						factor = Math.min(factor, options.accelerationMax);
						left *= factor;
						top  *= factor;
					}
				}
				lastScroll = +new Date();
			}

			// push a scroll command
			que.push({
				x: left,
				y: top,
				lastX: (left < 0) ? 0.99 : -0.99,
				lastY: (top  < 0) ? 0.99 : -0.99,
				start: +new Date()
			});

			// don't act if there's a pending queue
			if (pending) {
				return;
			}

			var scrollWindow = (elem === document.body);

			var step = function () {

				var now = +new Date();
				var scrollX = 0;
				var scrollY = 0;

				for (var i = 0; i < que.length; i++) {

					var item = que[i];
					var elapsed  = now - item.start;
					var finished = (elapsed >= options.animationTime);

					// scroll position: [0, 1]
					var position = (finished) ? 1 : elapsed / options.animationTime;

					// easing [optional]
					if (options.pulseAlgorithm) {
						position = pulse(position);
					}

					// only need the difference
					var x = (item.x * position - item.lastX) >> 0;
					var y = (item.y * position - item.lastY) >> 0;

					// add this to the total scrolling
					scrollX += x;
					scrollY += y;

					// update last values
					item.lastX += x;
					item.lastY += y;

					// delete and step back if it's over
					if (finished) {
						que.splice(i, 1); i--;
					}
				}

				// scroll left and top
				if (scrollWindow) {
					window.scrollBy(scrollX, scrollY);
				}
				else {
					if (scrollX) { elem.scrollLeft += scrollX; }
					if (scrollY) { elem.scrollTop  += scrollY; }
				}

				// clean up if there's nothing left to do
				if (!left && !top) {
					que = [];
				}

				if (que.length) {
					requestFrame(step, elem, (delay / options.frameRate + 1));
				} else {
					pending = false;
				}
			};

			// start a new queue of actions
			requestFrame(step, elem, 0);
			pending = true;
		}


		/***********************************************
		 * EVENTS
		 ***********************************************/

		/**
		 * Mouse wheel handler.
		 * @param {Object} event
		 */
		function wheel(event) {
			if (event.defaultPrevented) {
				return;
			}

			if (!initDone) {
				init();
			}

			var target = event.target;
			var overflowing = overflowingAncestor(target);

			// use default if there's no overflowing element
			if (!overflowing) {
				return true;
			}

			var deltaX = event.wheelDeltaX || 0;
			var deltaY = event.wheelDeltaY || 0;

			// use wheelDelta if deltaX/Y is not available
			if (!deltaX && !deltaY) {
				deltaY = event.wheelDelta || 0;
			}

			// check if it's a touchpad scroll that should be ignored
			if (!options.touchpadSupport && isTouchpad(deltaY)) {
				return true;
			}

			// scale by step size
			// delta is 120 most of the time
			// synaptics seems to send 1 sometimes
			if (Math.abs(deltaX) > 1.2) {
				deltaX *= options.stepSize / 120;
			}
			if (Math.abs(deltaY) > 1.2) {
				deltaY *= options.stepSize / 120;
			}

			scrollArray(overflowing, -deltaX, -deltaY);
			event.preventDefault();
		}

		/**
		 * Keydown event handler.
		 * @param {Object} event
		 */
		function keydown(event) {

			var target   = event.target;
			var modifier = event.ctrlKey || event.altKey || event.metaKey ||
				(event.shiftKey && event.keyCode !== key.spacebar);

			// do nothing if user is editing text
			// or using a modifier key (except shift)
			// or in a dropdown
			if ( /input|textarea|select|embed/i.test(target.nodeName) ||
				target.isContentEditable ||
				event.defaultPrevented   ||
				modifier ) {
				return true;
			}
			// spacebar should trigger button press
			if (isNodeName(target, "button") &&
				event.keyCode === key.spacebar) {
				return true;
			}

			var shift, x = 0, y = 0;
			var elem = overflowingAncestor(activeElement);
			var clientHeight = !elem || elem === document.body
				? window.innerHeight
				: elem.clientHeight;

			switch (event.keyCode) {
				case key.up:
					y = -options.arrowScroll;
					break;
				case key.down:
					y = options.arrowScroll;
					break;
				case key.spacebar: // (+ shift)
					shift = event.shiftKey ? 1 : -1;
					y = -shift * clientHeight * 0.9;
					break;
				case key.pageup:
					y = -clientHeight * 0.9;
					break;
				case key.pagedown:
					y = clientHeight * 0.9;
					break;
				case key.home:
					y = -elem.scrollTop;
					break;
				case key.end:
					var damt = elem.scrollHeight - elem.scrollTop - clientHeight;
					y = (damt > 0) ? damt+10 : 0;
					break;
				case key.left:
					x = -options.arrowScroll;
					break;
				case key.right:
					x = options.arrowScroll;
					break;
				default:
					return true; // a key we don't care about
			}

			scrollArray(elem, x, y);
			event.preventDefault();
		}

		/**
		 * Mousedown event only for updating activeElement
		 */
		function mousedown(event) {
			activeElement = event.target;
		}


		/***********************************************
		 * OVERFLOW
		 ***********************************************/

		var cache = {}; // cleared out every once in while
		setInterval(function () { cache = {}; }, 10 * 1000);

		var uniqueID = (function () {
			var i = 0;
			return function (el) {
				return el.uniqueID || (el.uniqueID = i++);
			};
		})();

		function setCache(elems, overflowing) {
			for (var i = elems.length; i--;) {
				cache[uniqueID( elems[i] )] = overflowing;
			}
			return overflowing;
		}

		function overflowingAncestor(el) {
			var elems = [];
			do {
				var cached = cache[uniqueID(el)];
				if (cached) {
					return setCache(elems, cached);
				}
				elems.push(el);
				if (el.clientHeight < el.scrollHeight) {
					var overflow = getComputedStyle(el, "").getPropertyValue("overflow-y");
					if (overflow === "scroll" || overflow === "auto") {
						return setCache(elems, el);
					}
				}
			} while ((el = el.parentNode));
		}


		/***********************************************
		 * HELPERS
		 ***********************************************/

		function addEvent(type, fn, bubble) {
			window.addEventListener(type, fn, (bubble||false));
		}

		function removeEvent(type, fn, bubble) {
			window.removeEventListener(type, fn, (bubble||false));
		}

		function isNodeName(el, tag) {
			return (el.nodeName||"").toLowerCase() === tag.toLowerCase();
		}

		function directionCheck(x, y) {
			x = (x > 0) ? 1 : -1;
			y = (y > 0) ? 1 : -1;
			if (direction.x !== x || direction.y !== y) {
				direction.x = x;
				direction.y = y;
				que = [];
				lastScroll = 0;
			}
		}


		function isTouchpad(deltaY) {
			if (!deltaY) { return; }
			deltaY = Math.abs(deltaY);
			deltaBuffer.push(deltaY);
			deltaBuffer.shift();
			var allEquals    = (deltaBuffer[0] === deltaBuffer[1] &&
				deltaBuffer[1] === deltaBuffer[2]);
			var allDivisable = (isDivisible(deltaBuffer[0], 120) &&
				isDivisible(deltaBuffer[1], 120) &&
				isDivisible(deltaBuffer[2], 120));
			return !(allEquals || allDivisable);
		}

		function isDivisible(n, divisor) {
			return (Math.floor(n / divisor) === n / divisor);
		}


		var requestFrame = (function () {
			return  window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				function (callback, element, delay) {
					window.setTimeout(callback, delay || (1000/60));
				};
		})();


		/***********************************************
		 * PULSE
		 ***********************************************/

		/**
		 * Viscous fluid with a pulse for part and decay for the rest.
		 * - Applies a fixed force over an interval (a damped acceleration), and
		 * - Lets the exponential bleed away the velocity over a longer interval
		 * - Michael Herf, http://stereopsis.com/stopping/
		 */
		function pulse_(x) {
			var val, start, expx;
			// test
			x = x * options.pulseScale;
			if (x < 1) { // acceleartion
				val = x - (1 - Math.exp(-x));
			} else {     // tail
				// the previous animation ended here:
				start = Math.exp(-1);
				// simple viscous drag
				x -= 1;
				expx = 1 - Math.exp(-x);
				val = start + (expx * (1 - start));
			}
			return val * options.pulseNormalize;
		}

		function pulse(x) {
			if (x >= 1) { return 1; }
			if (x <= 0) { return 0; }

			if (options.pulseNormalize === 1) {
				options.pulseNormalize /= pulse_(1);
			}
			return pulse_(x);
		}

		addEvent("mousedown", mousedown);
		addEvent("mousewheel", wheel);
		addEvent("load", init);




		// SmoothScroll v1.2.1
		// Licensed under the terms of the MIT license.
		// Balázs Galambosi (c) 2013

		/**
		 * A module for middle mouse scrolling.
		 */
		(function() {

			var defaultOptions = {
				middleMouse : true,
				frameRate   : 60
			};

			var options = Object.create( defaultOptions );

			var icon = document.createElement("i"); // img at the reference point
			var scrolling = false; // guards one phase


			// we check the OS for default middle mouse behavior only!
			var isLinux = (navigator.platform.indexOf("Linux") !== -1);


			/**
			 * Initializes the image at the reference point.
			 */
			icon.classList.add( "fa" );
			icon.classList.add( "fa-arrows-alt" );
			var style = icon.style;
			style.display    = "block";
			style.position   = "fixed";
			style.zIndex     = "1000";
			style.margin     = "0";
			style.fontSize   = "25px";
			style.WebkitTextStrokeWidth = "1px";
			style.WebkitTextStrokeColor = "#000";
			style.WebkitTextFillColor   = "#fff";

			/**
			 * Shows the reference image, and binds event listeners for scrolling.
			 * It also manages the animation.
			 * @param {Object} e
			 */
			function mousedown(e) {

				var elem = e.target;

				// watch for middle clicks only
				if ( e.button !== 1 || !options.middleMouse ) {
					return;
				}

				// linux middle mouse shouldn't be overwritten (paste)
				if ( isLinux && /input|textarea/i.test( elem.nodeName ) ) {
					return;
				}

				do {
					// ignore anchors
					if ( elem.tagName === "A" ) {
						return;
					}
				} while ( ( elem = elem.parentNode ) );

				elem = overflowingAncestor( e.target );
				if ( !elem ) {
					return;
				}

				// only apply to scrollable regions
				if ( elem.clientHeight === elem.scrollHeight ) {
					return;
				}

				// we don't want the default by now
				e.preventDefault();

				// quit if there's an ongoing scrolling
				if (scrolling) {
					return;
				}

				// set up a new scrolling phase
				scrolling = true;

				// reference point
				icon.style.left = e.clientX - 10 + "px";
				icon.style.top  = e.clientY - 10 + "px";
				document.body.appendChild(icon);

				var refereceX = e.clientX;
				var refereceY = e.clientY;

				var speedX = 0;
				var speedY = 0;

				// animation loop
				var last = +new Date();
				var delay = 1000 / options.frameRate;
				var finished = false;

				requestFrame(function step(time) {
					var now = time || +new Date();
					var elapsed = now - last;
					elem.scrollLeft += (speedX * elapsed) >> 0;
					elem.scrollTop  += (speedY * elapsed) >> 0;
					last = now;
					if (!finished) {
						requestFrame(step, elem, delay);
					}
				}, elem, delay);

				var first = true;

				function mousemove(e) {
					var deltaX = Math.abs(refereceX - e.clientX);
					var deltaY = Math.abs(refereceY - e.clientY);
					var movedEnough = Math.max(deltaX, deltaY) > 10;
					if (first && movedEnough) {
						addEvent("mouseup", remove);
						first = false;
					}
					speedX = (e.clientX - refereceX) * 10 / 1000;
					speedY = (e.clientY - refereceY) * 10 / 1000;
				}

				function remove() {
					removeEvent("mousemove", mousemove);
					removeEvent("mousedown", remove);
					removeEvent("mouseup", remove);
					removeEvent("keydown", remove);
					document.body.removeChild(icon);
					scrolling = false;
					finished  = true;
				}

				addEvent("mousemove", mousemove);
				addEvent("mousedown", remove);
				addEvent("keydown", remove);
			}

			addEvent("mousedown", mousedown);
			addEvent("DOMContentLoaded", init);

		})();

	};

});

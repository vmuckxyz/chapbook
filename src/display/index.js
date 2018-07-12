// Manages keeping the DOM in sync with state, and manages bridging events in
// the DOM with the engine.
//
// This supports hooks via the following attributes:
// - `data-cb-go`: calls go() on the passage in the attribute when the element
//   is clicked.
// - `data-cb-restart: calls restart() when the element is clicked.
// - `data-cb-cycle`: cycles the inner text of the element between the values
//   listed in the attribute when the element is clicked. The attribute must be
//   a JSON-encoded array.

import closest from 'closest';
import coalesceCalls from '../util/coalesce-calls';
import event from '../event';
import {crossfade, fadeInOut, none} from './transitions';
import {get} from '../state';
import {go, restart} from '../author/actions';
import {init as initCrash} from './crash';
import {passageNamed} from '../story';
import {render} from '../template';
import {validate} from './inputs';
import './index.scss';

let mainContent, marginals;
const transitions = {crossfade, fadeInOut, none};

export const defaults = {
	'config.body.transition.name': 'crossfade',
	'config.body.transition.duration': '500ms',
	'config.header.left': '',
	'config.header.center': '',
	'config.header.right': '',
	'config.header.transition.name': 'crossfade',
	'config.header.transition.duration': '500ms',
	'config.footer.left': '_`story.name()`_',
	'config.footer.center': '',
	'config.footer.right': "`link('Restart').restart()`",
	'config.footer.transition.name': 'crossfade',
	'config.footer.transition.duration': '500ms'
};

function attachDomListeners(el) {
	el.addEventListener('click', e => {
		// Order is important below, so that if an element both cycles and goes,
		// the value it sets before leaving the passage is accurate.

		const cycleLink = closest(e.target, '[data-cb-cycle]', true);

		if (cycleLink) {
			const choices = JSON.parse(cycleLink.dataset.cycle);
			let index = choices.indexOf(cycleLink.textContent) + 1;

			if (index === choices.length) {
				index = 0;
			}

			cycleLink.textContent = choices[index];
		}

		const goLink = closest(e.target, '[data-cb-go]', true);

		if (goLink) {
			validate().then(() => go(goLink.dataset.cbGo));
		}

		const restartLink = closest(e.target, '[data-cb-restart]', true);

		if (restartLink) {
			restart();
		}
	});
}

const updateDom = coalesceCalls(function update(calls) {
	// Update the trail if we were ever passed a `true` argument.

	if (calls.some(c => c[0])) {
		const trail = get('trail');
		const bodyTransition = get('config.body.transition.name');

		if (transitions[bodyTransition]) {
			transitions[bodyTransition](
				mainContent,
				render(passageNamed(trail[trail.length - 1]).source),
				get('config.body.transition.duration')
			);
		} else {
			transitions.none(
				mainContent,
				render(passageNamed(trail[trail.length - 1]).source)
			);
		}
	}

	// Always update header and footer, because we don't know what their
	// contents may depend on.

	['header', 'footer'].forEach(m => {
		marginals[m].container.classList.remove('has-content');

		['left', 'center', 'right'].forEach(part => {
			const html = render(get(`config.${m}.${part}`));

			if (html !== '') {
				marginals[m].container.classList.add('has-content');
			}

			const marginalTransition = get(`config.${m}.transition.name`);

			if (transitions[marginalTransition]) {
				transitions[marginalTransition](
					marginals[m][part],
					html,
					get(`config.${m}.transition.duration`)
				);
			} else {
				transitions.none(marginals[m][part], html);
			}
		});
	});
});

export function init() {
	initCrash();
	mainContent = document.querySelector('#page article');
	marginals = {};

	['header', 'footer'].forEach(m => {
		marginals[m] = {container: document.querySelector(`#page ${m}`)};
		['left', 'center', 'right'].forEach(part => {
			marginals[m][part] = document.querySelector(`#page ${m} .${part}`);
		});
	});

	attachDomListeners(document.body);
	event.on('state-change', ({name, value}) => updateDom(name === 'trail'));
}

// ***** One Line Utils *****
// Generates a new color that is lighter
const getLighterColor = (color) => '#' + color.match(/#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/).slice(1).map((v) => parseInt(v, 16) + 128).map((v) => (v > 255 ? 255 : v).toString(16)).join('') // prettier-ignore

// ***** Constants *****
// Select app container
const appContainerElement = document.querySelector('.app-container')
// Select container which holds all cursor control elements
const cursorContainerElement = document.querySelector('.cursor-controls-list-container')
// Select switch to control all cursors display states
const allCursorsSwitchElement = document.querySelector('.controls-group-container .cursor-controls-container:nth-child(1) input.switch')
// Select switch to control all cursors name display states
const allNamesSwitchElement = document.querySelector('.controls-group-container .cursor-controls-container:nth-child(2) input.switch')
// Select slider to control all cursors opacity
const allOpacitiesSwitchElement = document.querySelector('.controls-group-container .cursor-controls-container:nth-child(3) input.slider')

// ***** Variables *****
// Current tab id
let tabId = null
// Connection Port
let port = null
// Code that identifies a specific concept board
let boardCode = null
// States of 'all cursors' controls
let allCursorsData = null
// Cursor data
let lastCursorData = []

// ***** Init *****
;(async () => {
	// Get currently shown tab
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
	// Exit if url does not match pattern
	if (!tab?.url.match(/https:\/\/.+\.conceptboard\.com\/board\/.+/)) return invalidUrl()
	// Tab id to set up port connection
	tabId = tab.id
	// Extract board code from url
	boardCode = tab.url.match(/(?:\b[a-z0-9]{4}\b-){4}(?:\b[a-z0-9]{4}\b)/)[0]
	// Init port communication
	initPort()
	// Init local storage and load data
	await initStorage()

	// ***** Listeners *****
	// Add listener for 'all cursors enabled' switch
	allCursorsSwitchElement.addEventListener('click', async (e) => {
		allCursorsData.all_enabled = e.target.checked
		setAllCursorsEnabled(e.target.checked)
		await setValue('all_cursors', allCursorsData)
	})
	// Add listener for 'all cursors names' switch
	allNamesSwitchElement.addEventListener('click', async (e) => {
		allCursorsData.all_names = e.target.checked
		setAllNamesEnabled(e.target.checked)
		await setValue('all_cursors', allCursorsData)
	})
	// Add listener for 'all cursors opacities' switch
	allOpacitiesSwitchElement.addEventListener('input', async (e) => {
		const oldValue = allCursorsData.all_opacities
		allCursorsData.all_opacities = e.target.value
		setAllOpacities(e.target.value, oldValue)
		await setValue('all_cursors', allCursorsData)
	})
	// Add listener for storage change
	browser.storage.local.onChanged.addListener(handleStorageChange)
})()
// Init port communication to content script
function initPort() {
	port = browser.tabs.connect(tabId, { name: 'edit_cursors' })
	port.onMessage.addListener(onMsg)
}
// Init local storage and load data
async function initStorage() {
	const [allCursors, cursors] = await Promise.all([getValue('all_cursors'), getValue('cursors')])
	update(cursors || [])
	allCursorsData = allCursors === undefined ? { all_enabled: true, all_names: true, all_opacities: 100 } : allCursors
	allCursorsSwitchElement.checked = allCursorsData.all_enabled
	allNamesSwitchElement.checked = allCursorsData.all_names
	allOpacitiesSwitchElement.value = allCursorsData.all_opacities
	if (allCursors === undefined) await setValue('all_cursors', allCursorsData)
}

// ***** Messages *****
// Send messages to content script
function sendMsg(type, data) {
	port.postMessage([type, JSON.stringify(data)])
}
// Handle incoming messages
function onMsg(type) {
	if (type === 'ping') sendMsg('pong')
}

// ***** Storage *****
// Set values in local storage
async function setValue(key, value) {
	await browser.storage.local.set({ [`boardStorage_${boardCode}#${key}`]: value })
}
// Get values from local storage
async function getValue(key) {
	const data = await browser.storage.local.get(`boardStorage_${boardCode}#${key}`)
	return data[`boardStorage_${boardCode}#${key}`]
}
// Handle incoming messages
function handleStorageChange(changes) {
	Object.keys(changes).forEach((fullKey) => {
		if (!fullKey.startsWith(`boardStorage_${boardCode}#`)) return
		const key = fullKey.match(/boardStorage_.+#(.+)/)[1]
		const { oldValue, newValue } = changes[fullKey]
		if (key === 'cursors') {
			update(newValue, oldValue)
		}
	})
}

// ***** Cursors controls *****
// Create control elements for cursor
function createCursorControls(name, color, uuid, enable, showName, opacity) {
	const CONTROLS = [
		{ type: 'switch', send: 'change_cursor_display', text: name, state: enable },
		{ type: 'switch', send: 'change_name_display', text: 'Show Name', state: showName },
		{ type: 'slider', send: 'change_cursor_opacity', text: 'Opacity', state: opacity, config: { min: 1, max: 100 } },
	]

	const group = document.createElement('div')
	group.classList.add('controls-group-container')
	group.dataset.uuid = uuid

	CONTROLS.forEach((c, index) => {
		const container = document.createElement('div')
		container.classList.add('cursor-controls-container')
		container.dataset.uuid = uuid
		const text = document.createElement('span')
		text.classList.add('description-text')
		text.textContent = c.text
		if (c.type === 'switch') {
			const checkbox = document.createElement('input')
			checkbox.type = 'checkbox'
			checkbox.checked = c.state
			checkbox.classList.add('switch')
			checkbox.classList.add('cursor-switch')
			checkbox.id = index + '-switch-' + uuid
			checkbox.addEventListener('click', async (e) => {
				sendMsg(c.send, { uuid, enable: e.target.checked })
			})
			const label = document.createElement('label')
			label.setAttribute('for', index + '-switch-' + uuid)
			label.style = `--color-fg: ${color}; --color-bg: ${getLighterColor(color)};`
			container.append(text, checkbox, label)
		} else if (c.type === 'slider') {
			const range = document.createElement('input')
			range.type = 'range'
			range.min = c.config.min
			range.max = c.config.max
			range.value = c.state
			range.classList.add('slider')
			range.classList.add('cursor-slider')
			range.addEventListener('input', async (e) => {
				sendMsg(c.send, { uuid, value: e.target.value })
			})
			range.style = `--color-fg: ${color}; --color-bg: ${getLighterColor(color)};`
			container.append(text, range)
		}
		group.append(container)
	})
	cursorContainerElement.append(group)
}
// Update cursor list
async function update(updates, oldCursorData = []) {
	const { added, removed } = arrayDiff(
		oldCursorData.map((cursor) => cursor.uuid),
		updates.map((update) => update.uuid)
	)
	removed.forEach((uuid) => cursorContainerElement.querySelector(`.controls-group-container[data-uuid='${uuid}'`)?.remove())
	added.forEach((uuid) => {
		const c = updates.find((update) => update.uuid === uuid)
		createCursorControls(c.name, c.color, c.uuid, c.enable, c.show_name, c.opacity)
	})
}
// Control all switches
function setAllCursorsEnabled(enable) {
	const cursorControlSwitchElements = cursorContainerElement.querySelectorAll('.controls-group-container .cursor-controls-container:nth-child(1) input.switch')
	const changes = []
	cursorControlSwitchElements.forEach((control) => {
		if (control.checked !== enable) control.checked = enable
		changes.push({ uuid: control.parentNode.dataset.uuid, enable })
	})
	sendMsg('change_cursor_display', changes)
}
// Control all switches
function setAllNamesEnabled(enable) {
	const cursorControlSwitchElements = cursorContainerElement.querySelectorAll('.controls-group-container .cursor-controls-container:nth-child(2) input.switch')
	const changes = []
	cursorControlSwitchElements.forEach((control) => {
		if (control.checked !== enable) control.checked = enable
		changes.push({ uuid: control.parentNode.dataset.uuid, enable })
	})
	sendMsg('change_name_display', changes)
}
// Control all sliders
function setAllOpacities(value, oldValue) {
	const cursorControlSliderElements = cursorContainerElement.querySelectorAll('.controls-group-container .cursor-controls-container:nth-child(3) input.slider')
	const changes = []
	cursorControlSliderElements.forEach((control) => {
		if (control.value > Math.max(value, oldValue) || control.value < Math.min(value, oldValue)) return
		control.value = value
		changes.push({ uuid: control.parentNode.dataset.uuid, value })
	})
	sendMsg('change_cursor_opacity', changes)
}
// Handle pages with invalid urls
function invalidUrl() {
	appContainerElement.classList.add('disabled')
}

// ***** Utils *****
// Get difference of two arrays
function arrayDiff(arr1, arr2) {
	if (!arr1 && !arr2) return { added: [], removed: [] }
	else if (!arr1) return { added: [...arr2], removed: [] }
	else if (!arr2) return { added: [], removed: [...arr1] }
	const removed = arr1.filter((elem) => !arr2.includes(elem))
	const added = arr2.filter((elem) => !arr1.includes(elem))
	return { added, removed }
}

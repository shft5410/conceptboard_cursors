// ***** One Line Utils *****
// Convert rgb(...,...,...) to hex #......
const rgbToHex = (rgb) =>`#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}` // prettier-ignore

// ***** Constants *****
// Select cursor container
const userCursorsContainerElement = document.querySelector('.user-cursors-container')
// Extract board code from url
const boardCode = location.href.match(/(?:\b[a-z0-9]{4}\b-){4}(?:\b[a-z0-9]{4}\b)/)[0]

// ***** Variables *****
// Cursor data
let cursorData = []
// State of of 'all cursors' switch
let allCursorsEnabled = null

// ***** Init *****
;(async () => {
	// Init local storage and load data
	await initStorage()

	// ***** Observers *****
	// Observer to observe changes in cursor container
	new MutationObserver(update).observe(userCursorsContainerElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })

	// ***** Listeners *****
	// Add listener for storage change
	browser.storage.local.onChanged.addListener(handleStorageChange)
})()
// Init local storage and load data
async function initStorage() {
	const allCursors = await getValue('all_cursors')
	allCursorsEnabled = allCursors === undefined ? true : allCursors
	await setValue('cursors', [])
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
// Handle change of storage
function handleStorageChange(changes) {
	Object.keys(changes).forEach((fullKey) => {
		if (!fullKey.startsWith(`boardStorage_${boardCode}#`)) return
		const key = fullKey.match(/boardStorage_.+#(.+)/)[1]
		const { newValue } = changes[fullKey]
		if (key === 'all_cursors') {
			allCursorsEnabled = newValue
		}
	})
}

// ***** Cursor data *****
// Save cursor data to storage
async function update(mutationList) {
	if (!mutationList) return
	const cursorDataLocal = [...cursorData]
	mutationList.forEach((mutation) => {
		if (mutation.type === 'childList') {
			if (mutation.target.classList.contains('user-cursors-container')) {
				mutation.addedNodes.forEach((node) => {
					node.style.display = allCursorsEnabled ? 'initial' : 'none'
					node.dataset.uuid = crypto.randomUUID()
				})
				mutation.removedNodes.forEach((node) => {
					const index = cursorDataLocal.findIndex((cursor) => cursor.uuid === node.dataset.uuid)
					if (index < 0) return
					cursorDataLocal.splice(index, 1)
				})
			} else if (mutation.target.classList.contains('user-mouse-cursor')) {
				const cursor = { enable: mutation.target.style.display !== 'none', uuid: mutation.target.dataset.uuid }
				mutation.addedNodes.forEach((node) => {
					if (node.classList.contains('arrowlabel')) cursor.name = node.textContent
					else if (node.classList.contains('arrow1')) cursor.color = rgbToHex(node.style.borderColor)
				})
				cursorDataLocal.push(cursor)
			}
		} else if (mutation.type === 'attributes') {
			if (mutation.target.classList.contains('user-mouse-cursor')) {
				if (!mutation.target.dataset.uuid) return
				const index = cursorDataLocal.findIndex((cursor) => cursor.uuid === mutation.target.dataset.uuid)
				if (index < 0) return
				cursorDataLocal[index].enable = mutation.target.style.display !== 'none'
			}
		}
	})
	cursorData = cursorDataLocal
	await setValue('cursors', cursorDataLocal)
}

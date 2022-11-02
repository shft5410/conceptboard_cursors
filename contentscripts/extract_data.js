// ***** One Line Utils *****
// Convert rgb(...,...,...) to hex #......
const rgbToHex = (rgb) =>`#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}` // prettier-ignore

// ***** Constants *****
// Number of current version
const VERSION_NUMBER = '1.1.4'
// Select cursor container
const userCursorsContainerElement = document.querySelector('.user-cursors-container')
// Extract board code from url
const boardCode = location.href.match(/(?:\b[a-z0-9]{4}\b-){4}(?:\b[a-z0-9]{4}\b)/)[0]

// ***** Variables *****
// Cursor data
let cursorData = []
// Data about the behaviour of all cursors
let allCursorsData = null

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
	// Check for version change and fix incompatibilities
	const storageVersionChange = (await getValue('version')) !== VERSION_NUMBER
	setValue('version', VERSION_NUMBER)
	if (storageVersionChange) {
		await setValue('all_cursors', { all_enabled: true, all_names: true, all_opacities: 100 })
	}

	const allCursors = await getValue('all_cursors')
	allCursorsData = allCursors === undefined ? { all_enabled: true, all_names: true, all_opacities: 100 } : allCursors
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
			allCursorsData = newValue
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
					node.style.display = allCursorsData.all_enabled ? 'initial' : 'none'
					node.style.filter = `opacity(${allCursorsData.all_opacities}%)`
					node.dataset.uuid = crypto.randomUUID()
				})
				mutation.removedNodes.forEach((node) => {
					const index = cursorDataLocal.findIndex((cursor) => cursor.uuid === node.dataset.uuid)
					if (index < 0) return
					cursorDataLocal.splice(index, 1)
				})
			} else if (mutation.target.classList.contains('user-mouse-cursor')) {
				const cursor = {
					enable: mutation.target.style.display !== 'none',
					opacity: parseInt(mutation.target.style.filter.match(/(\d{1,3})/)[1]),
					uuid: mutation.target.dataset.uuid,
				}
				mutation.addedNodes.forEach((node) => {
					if (node.classList.contains('arrowlabel')) {
						node.style.display = allCursorsData.all_names ? 'initial' : 'none'
						cursor.show_name = allCursorsData.all_names
						cursor.name = node.textContent
					} else if (node.classList.contains('arrow1')) cursor.color = rgbToHex(node.style.borderColor)
				})
				cursorDataLocal.push(cursor)
			}
		} else if (mutation.type === 'attributes') {
			if (mutation.target.classList.contains('user-mouse-cursor')) {
				if (!mutation.target.dataset.uuid) return
				const index = cursorDataLocal.findIndex((cursor) => cursor.uuid === mutation.target.dataset.uuid)
				if (index < 0) return
				cursorDataLocal[index].enable = mutation.target.style.display !== 'none'
				cursorDataLocal[index].opacity = parseInt(mutation.target.style.filter.match(/(\d{1,3})/)[1])
			} else if (mutation.target.classList.contains('arrowlabel')) {
				if (!mutation.target.parentNode.dataset.uuid) return
				const index = cursorDataLocal.findIndex((cursor) => cursor.uuid === mutation.target.parentNode.dataset.uuid)
				if (index < 0) return
				cursorDataLocal[index].show_name = mutation.target.style.display !== 'none'
			}
		}
	})
	cursorData = cursorDataLocal
	await setValue('cursors', cursorDataLocal)
}

/* global Blob marked */

import './marked.min.js'

export function downloadTestResults (target, fileName, data, auto) {
  var dataBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'text/json' })
  target.setAttribute('href', window.URL.createObjectURL(dataBlob))
  target.setAttribute('download', fileName)
  target.style.display = 'inherit'
  if (auto) {
    target.click()
  }
}

export function renderTestResults (testSuites, testResults, testUUIDs, target, useBrowserCache) {
  var totalTests = 0
  var totalPassed = 0
  testSuites.forEach(testSuite => {
    var headerElement = document.createElement('h3')
    target.appendChild(headerElement)
    var headerText = document.createTextNode(testSuite.name)
    headerElement.appendChild(headerText)
    var listElement = document.createElement('ul')
    var resultList = target.appendChild(listElement)
    var tests = 0
    var passed = 0
    testSuite.tests.forEach(test => {
      if (test.browser_only === true && !useBrowserCache === true) return
      if (test.browser_skip === true && useBrowserCache === true) return
      test.suiteName = testSuite.name
      var testElement = resultList.appendChild(document.createElement('li'))
      testElement.appendChild(showTestResult(testSuites, test.id, testResults))
      testElement.appendChild(showTestName(test, testUUIDs[test.id]))
      tests++
      if (testResults[test.id] === true) {
        passed++
      }
    })
    var summaryElement = document.createElement('p')
    var suiteSummary = target.appendChild(summaryElement)
    suiteSummary.appendChild(document.createTextNode(tests + ' tests, ' + passed + ' passed.'))
    totalTests += tests
    totalPassed += passed
  })
  var totalElement = document.createElement('p')
  var totalSummary = target.appendChild(totalElement)
  var totalText = document.createTextNode('Total ' + totalTests + ' tests, ' + totalPassed + ' passed.')
  totalSummary.appendChild(totalText)
}

export function showTestName (test, uuid) {
  var wrapper = document.createElement('span')
  var span = document.createElement('span')
  span.title = JSON.stringify(test.requests, null, 2)
  span.innerHTML = marked.parse(test.name).slice(3, -5)
  span.addEventListener('click', event => {
    copyTextToClipboard(test.id)
  })
  wrapper.appendChild(span)

  if (uuid) {
    var uuidLinkElement = document.createElement('a')
    uuidLinkElement.appendChild(document.createTextNode('⚙︎'))
    uuidLinkElement.setAttribute('class', 'clickhint')
    uuidLinkElement.addEventListener('click', event => {
      copyTextToClipboard(uuid)
    })
    uuidLinkElement.title = 'Test UUID (click to copy)'
    wrapper.appendChild(uuidLinkElement)
  }
  return wrapper
}

export function showKey (element) {
  var spans = element.getElementsByClassName('fa')
  for (const span of spans) {
    var kind = span.getAttribute('data-kind')
    var styling = resultTypes[kind]
    var contentNode = document.createTextNode(styling[0])
    span.style.color = styling[1]
    span.appendChild(contentNode)
  }
}

export function showTestResult (testSuites, testId, testResults) {
  var result = testResults[testId]
  var resultValue = determineTestResult(testSuites, testId, testResults)
  var resultNode = document.createTextNode(` ${resultValue[0]} `)
  var span = document.createElement('span')
  span.className = 'fa'
  span.style.color = resultValue[1]
  span.appendChild(resultNode)
  if (result && typeof (result[1]) === 'string') {
    span.title = result[1]
  }
  return span
}

const resultTypes = {
  untested: ['-', '', '-'],
  pass: ['\uf058', '#1aa123', '✅'],
  fail: ['\uf057', '#c33131', '⛔️'],
  optional_fail: ['\uf05a', '#bbbd15', '⚠️'],
  yes: ['\uf055', '#999696', 'Y'],
  no: ['\uf056', '#999696', 'N'],
  setup_fail: ['\uf059', '#4c61ae', '🔹'],
  harness_fail: ['\uf06a', '#4c61ae', '⁉️'],
  dependency_fail: ['\uf192', '#b4b2b2', '⚪️'],
  retry: ['\uf01e', '#4c61ae', '↻']
}
const passTypes = [resultTypes.pass, resultTypes.yes]

export function determineTestResult (testSuites, testId, testResults, honorDependencies = true) {
  var test = testLookup(testSuites, testId)
  var result = testResults[testId]
  if (result === undefined) {
    return resultTypes.untested
  }
  if (honorDependencies && test.depends_on !== undefined) {
    for (var dependencyId of test.depends_on) {
      if (!passTypes.includes(determineTestResult(testSuites, dependencyId, testResults))) {
        return resultTypes.dependency_fail
      }
    }
  }
  if (result[0] === 'Setup') {
    if (result[1] === 'retry') {
      return resultTypes.retry
    } else {
      return resultTypes.setup_fail
    }
  }
  if (result === false && result[0] !== 'Assertion') {
    return resultTypes.harness_fail
  }
  if (test.kind === 'required' || test.kind === undefined) {
    if (result === true) {
      return resultTypes.pass
    } else {
      return resultTypes.fail
    }
  } else if (test.kind === 'optimal') {
    if (result === true) {
      return resultTypes.pass
    } else {
      return resultTypes.optional_fail
    }
  } else if (test.kind === 'check') {
    if (result === true) {
      return resultTypes.yes
    } else {
      return resultTypes.no
    }
  } else {
    throw new Error(`Unrecognised test kind ${test.kind}`)
  }
}

export function testLookup (testSuites, testId) {
  for (var testSuite of testSuites) {
    for (var test of testSuite.tests) {
      if (test.id === testId) {
        return test
      }
    }
  }
  throw new Error(`Cannot find test ${testId}`)
}

function copyTextToClipboard (text) {
  var textArea = document.createElement('textarea')
  textArea.style.position = 'fixed'
  textArea.style.top = 0
  textArea.style.left = 0
  textArea.style.width = '2em'
  textArea.style.height = '2em'
  textArea.style.padding = 0
  textArea.style.border = 'none'
  textArea.style.outline = 'none'
  textArea.style.boxShadow = 'none'
  textArea.style.background = 'transparent'
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    var successful = document.execCommand('copy')
    var msg = successful ? 'successful' : 'unsuccessful'
    console.log(`Copying text "${text}" was ${msg}`)
  } catch (err) {
    console.log('Unable to copy')
  }
  document.body.removeChild(textArea)
}

const Set = require('es6-set')
const Map = require('es6-map')
const React = require('react')
const ReactDOM = require('react-dom')
const AppState = require('./appstate.js')

const AllowedFormattingNodes = /^([bius])$/i // <b>, <i>, <s>, <u>
let editorNodeTypeNameTable = {}

class BaseEditorNodeComponent extends React.Component {
  static structureFromDataset (dataset) {
    // return { type: ..., ... }
    throw new Error('abstract.')
  }
  constructor (props) {
    super(props)
    // props.structure: structure for this editor node.
    this.handleDelete = this.handleDelete.bind(this)
    this.handleSorthand = this.handleSorthand.bind(this)
    if (new.target === BaseEditorNodeComponent) throw new Error('abstract.')
  }
  render () {
    // assert(this.props.structure.type === ...)
    throw new Error('abstract.')
  }
  toDataset () {
    // return { enType: ..., ... }
    throw new Error('abstract.')
  }
  getSorthand () {
    if (this.props.disabled) return null
    return (
      <span className='sorthand' onMouseDown={this.handleSorthand} onMouseUp={this.handleSorthand} onTouchStart={this.handleSorthand}>
        <svg className="icon ii-sorthand"><use href="#ii-sorthand" xlinkHref="#ii-sorthand" /></svg>
      </span>
    )
  }
  getDeleteBtn () {
    if (this.props.disabled) return null
    return (
      <span className='delete' onClick={this.handleDelete}>
        <svg className="icon ii-del"><use href="#ii-del" xlinkHref="#ii-del" /></svg>
      </span>
    )
  }
  handleSorthand () {
    if (this.props.onSorthand) {
      this.props.onSorthand()
    }
  }
  handleDelete (evt) {
    if (!this.props.onUpdateStructure) {
      throw new Error('no props.onUpdateStructure')
    }
    this.props.onUpdateStructure(null)
  }
}

class HiderEditorNode extends BaseEditorNodeComponent {
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'hider') throw new Error('dataset invalid.')
    return {
      type: 'hider',
      hidden: dataset.hidden === 'true',
      content: JSON.parse(dataset.content || '[]')
    }
  }
  constructor (props) {
    super(props)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.toggleHide = this.toggleHide.bind(this)
  }
  render () {
    return (
      <div className='enHider'>
        <div className='menu'>
          {this.getSorthand()}
          {this.getDeleteBtn()}
          <span className='hide' onClick={this.toggleHide}>
            <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
          </span>
        </div>
        <div className='contentcontain'>
          {this.props.structure.hidden
            ? (
                <div className='hiddenplaceholder'>
                  Content hidden. Click&nbsp;
                  <span onClick={this.toggleHide}>
                    <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
                  </span>
                  &nbsp;to reveal.
                </div>
              )
            : (
                <Editor structure={this.props.structure.content || []} onChange={this.handleInputChange} disabled={this.props.disabled} />
              )}
        </div>
      </div>
    )
  }
  handleInputChange (nContent) {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      content: nContent
    }))
  }
  toDataset () {
    return {
      enType: 'hider',
      hidden: (this.props.structure.hidden ? 'true' : 'false'),
      content: JSON.stringify(this.props.structure.content || '[]')
    }
  }
  toggleHide () {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      hidden: !this.props.structure.hidden
    }))
  }
}
editorNodeTypeNameTable.hider = HiderEditorNode

class PaperCropEditorNode extends BaseEditorNodeComponent {
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'paperCrop') throw new Error('dataset invalid.')
    let struct = {
      type: 'paperCrop',
      doc: dataset.doc === 'null' ? null : dataset.doc,
      page: dataset.page === 'null' ? null : parseInt(dataset.page)
    }
    if (!Number.isSafeInteger(struct.page) || (Number.isSafeInteger(struct.page) && struct.page < 0)) struct.page = null
    if (!struct.doc) struct.doc = null
    return struct
  }
  constructor (props) {
    super(props)
    this.handleApplySelection = this.handleApplySelection.bind(this)
  }
  componentDidMount () {
    this.unsub = AppState.subscribe(() => {this.forceUpdate()})
  }
  componentWillUnmount () {
    this.unsub()
  }
  render () {
    return (
      <div className='enPaperCrop'>
        <div className='menu'>
          {this.getSorthand()}
          {this.getDeleteBtn()}
          {this.props.disabled && !this.props.structure.doc
            ? (
                <span>Empty clip.</span>
              ) : null}
        </div>
        {!this.props.structure.doc && !AppState.getState().paperCropClipboard && !this.props.disabled
          ? (
              <div className='prompt'>
                Select a paper by&nbsp;
                  <a onClick={evt => AppState.dispatch({type: 'home-from-collection'})}>searching</a>
                  &nbsp;for some and click the <span>
                  <svg className="icon ii-crop"><use href="#ii-crop" xlinkHref="#ii-crop" /></svg>
                </span> button, then go here and apply it.
              </div>
            )
          : null}
        {!this.props.structure.doc && AppState.getState().paperCropClipboard && !this.props.disabled
          ? (
              <div className='prompt apply'>
                <a onClick={this.handleApplySelection}>Apply selection here</a>
              </div>
            )
          : null}
        {!this.props.structure.doc && AppState.getState().paperCropClipboard && this.props.disabled
          ? (
              <div className='prompt'>
                Can't apply your selection here since you can't edit this collection.
              </div>
            )
          : null}
        {this.props.structure.doc
          ? (
              <div>
                {this.props.structure.doc} - {this.props.structure.page}
              </div>
            )
          : null}
      </div>
    )
  }
  toDataset () {
    let dataPage = this.props.structure.page
    if (Number.isSafeInteger(dataPage)) dataPage = dataPage.toString()
    else dataPage = 'null'
    return {
      enType: 'paperCrop',
      doc: this.props.structure.doc || 'null',
      page: dataPage
    }
  }
  handleApplySelection () {
    let clip = AppState.getState().paperCropClipboard
    if (!clip) return
    if (!clip.doc) return
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      doc: clip.doc,
      page: clip.page
    }))
  }
}
editorNodeTypeNameTable.paperCrop = PaperCropEditorNode

class Editor extends React.Component {
  constructor (props) {
    super(props)
    this.btnStateInterval = null
    this.handleInput = this.handleInput.bind(this)
    this.currentDOMStructure = null
    this.currentEditorNodes = new Map() // dom node -> component
  }
  componentDidMount () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
    if (this.btnStateInterval === null) this.btnStateInterval = setInterval(() => this.forceUpdate(), 1000)
  }
  componentWillUnmount () {
    if (this.btnStateInterval !== null) {
      clearInterval(this.btnStateInterval)
      this.btnStateInterval = null
    }
  }
  componentDidUpdate () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
  }
  nodeIsEditorNode (node) {
    return node.dataset.editornode === 'true'
  }
  normalizeHTML (html = '', nestedEditorNodeCallback = null) {
    let parser = new DOMParser()
    let parsedDOM = parser.parseFromString(html, 'text/html')
    if (!parsedDOM.body) {
      return html
    }
    let nodes = parsedDOM.body.childNodes
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]
      if (node.nodeName === '#text') continue
      if (AllowedFormattingNodes.test(node.nodeName)) {
        let newElement = parsedDOM.createElement(node.nodeName)
        newElement.innerHTML = this.normalizeHTML(node.innerHTML, nestedEditorNodeCallback)
        parsedDOM.body.replaceChild(newElement, node)
      } else if (/^(del|strike)$/i.test(node.nodeName)) {
        let newElement = parsedDOM.createElement('s') // <del>/<strike> -> <s>
        newElement.innerHTML = this.normalizeHTML(node.innerHTML, nestedEditorNodeCallback)
        parsedDOM.body.replaceChild(newElement, node)
      } else if (node.nodeName.toLowerCase() === 'br' && i === nodes.length - 1) { // Firefox wired behavior
        let newNode = parsedDOM.createElement('br')
        parsedDOM.body.replaceChild(newNode, node)
      } else if (this.nodeIsEditorNode(node)) {
        if (nestedEditorNodeCallback) {
          nestedEditorNodeCallback(node)
          this.recycleNode(node)
          node.remove()
        } else {
          let newNode = parsedDOM.createTextNode('<Invalid editor node>')
          parsedDOM.body.replaceChild(newNode, node)
        }
      } else {
        let newNode = parsedDOM.createTextNode(node.innerText)
        parsedDOM.body.replaceChild(newNode, node)
      }
    }
    let newHtml = parsedDOM.body.innerHTML
    if (newHtml === '') {
      return '&nbsp;'
    }
    return newHtml
  }

  dom2structure (domElement) {
    let structure = [] // This get stored in the content of the collection.
    /*
      Each element of this structure array is either a:
        * Paragraph containing formatted text: { type: 'text', html: normalizedHTML }
          Mergeable.
    */
    let isLastNodeInline = false // Whether the last node is a part of a paragraph. I.e. #text, b, i, etc., rather than a concrete paragraph.
    let nodes = domElement.childNodes
    for (let i = 0; i < nodes.length; i ++) {
      let node = nodes[i]
      let hangingEditorNodes = []
      if (node.nodeName.toLowerCase() === '#text' || AllowedFormattingNodes.test(node.nodeName)) {
        if (isLastNodeInline && structure.length > 0) {
          let lastStructure = Object.assign({}, structure[structure.length - 1])
          if (!lastStructure.type === 'text') {
            throw new Error("lastStructure isn't of type text but isLastNodeInline == true.")
          }
          lastStructure.html = this.normalizeHTML(lastStructure.html + (node.outerHTML || node.nodeValue || ''), editorNode => {
            hangingEditorNodes.push(editorNode)
          })
          structure[structure.length - 1] = lastStructure
        } else {
          structure.push({
            type: 'text',
            html: this.normalizeHTML(node.outerHTML || node.nodeValue || '')
          })
        }
        isLastNodeInline = true
      } else if (node.nodeName.toLowerCase() === 'p') {
        structure.push({
          type: 'text',
          html: this.normalizeHTML(node.innerHTML || node.nodeValue || '', editorNode => {
            hangingEditorNodes.push(editorNode)
          })
        })
        isLastNodeInline = false
      } else if (node.nodeName.toLowerCase() === 'br') {
        isLastNodeInline = false
      } else if (this.nodeIsEditorNode(node)) {
        structure.push(this.editorNode2Structure(node))
        isLastNodeInline = false
      } else {
        isLastNodeInline = true
      }
      hangingEditorNodes.forEach(node => {
        structure.push(this.editorNode2Structure(node))
      })
    }
    let emptyParagraph = st => st.type === 'text' && st.html.replace(/<br>/i, '').trim() === ''
    while (structure.length >= 2 && emptyParagraph(structure[structure.length - 1]) && emptyParagraph(structure[structure.length - 2])) {
      structure.splice(structure.length - 1, 1)
    }
    return structure // Do not modify on top of this. Always create a new one.
  }

  editorNode2Structure (node) {
    let component = this.currentEditorNodes.get(node)
    if (!component) {
      // Probably copy-pasted orphan node. Lets construct component for it (but don't render, cuz pure function).
      let componentClass = editorNodeTypeNameTable[node.dataset.enType]
      if (!componentClass) {
        return {
          type: 'text',
          html: '&lt;Invalid node&gt;'
        }
      }
      try {
        return componentClass.structureFromDataset(node.dataset)
      } catch (e) {
        console.error(e)
        return {
          type: 'text',
          html: '&lt;Invalid node data&gt;'
        }
      }
    } else {
      return component.props.structure
    }
  }

  recycleNode (node) {
    if (!(node instanceof Element)) return
    if (this.currentEditorNodes.has(node)) {
      this.currentEditorNodes.delete(node)
    }
    ReactDOM.unmountComponentAtNode(node)
  }

  structure2dom (structure, domElement) {
    if (this.currentDOMStructure === structure) {
      return
    }
    console.log('structure2dom')
    let touchedEditorNodes = new Set()
    let processEditorNode = (current, currentElement) => {
      // React.render into old node will update the content (and the component's props).
      let componentClass = editorNodeTypeNameTable[current.type]
      if (!componentClass) {
        if (currentElement) {
          this.recycleNode(currentElement)
          currentElement.remove() // To not complicate matters.
        }
        return null
      }
      let thisEditor = this
      let enDOM = null
      let reactElement = React.createElement(componentClass, {
        structure: current,
        disabled: thisEditor.props.disabled,
        onUpdateStructure: function (newStructure) {
          if (thisEditor.props.structure !== structure) {
            thisEditor.forceUpdate()
            return
          }
          let newStructureArr = structure.map(st => (st === current ? newStructure : st))
            .filter(a => a !== null)
          thisEditor.props.onChange(newStructureArr)
        },
        onSorthand: function () {
          if (enDOM !== null) {
            let sel = window.getSelection()
            let range = document.createRange()
            range.selectNode(enDOM)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      })
      let nodeSet = this.currentEditorNodes
      if (currentElement && this.nodeIsEditorNode(currentElement)) {
        currentElement.dataset.editornode = 'true'
        currentElement.dataset.enType = current.type
        currentElement.contentEditable = 'false'
        ReactDOM.render(reactElement, currentElement, function () {
          // `this` is the component.
          nodeSet.set(currentElement, this)
          Object.assign(currentElement.dataset, this.toDataset())
        })
        touchedEditorNodes.add(currentElement)
        enDOM = currentElement
        return null
      } else {
        // Create a new node and render it.
        let newNode = document.createElement('div')
        newNode.dataset.editornode = 'true'
        newNode.dataset.enType = current.type
        newNode.contentEditable = 'false'
        // <div data-editornode="true" data-en-type="hider"></div>
        if (currentElement) {
          this.recycleNode(currentElement)
          domElement.replaceChild(newNode, currentElement)
        }
        ReactDOM.render(reactElement, newNode, function () {
          nodeSet.set(newNode, this)
          Object.assign(newNode.dataset, this.toDataset())
        })
        touchedEditorNodes.add(newNode)
        enDOM = newNode
        return newNode
      }
    }

    let replacementElementFromCurrentStructure = current => {
      if (!current || !current.type) {
        let errorMsg = document.createElement('p')
        errorMsg.innerText = '<invalid structure>'
        return errorMsg
      }
      let newElement
      switch (current.type) {
        case 'text':
        newElement = document.createElement('p')
        newElement.innerHTML = this.normalizeHTML(current.html)
        return newElement
        default:
        return processEditorNode(current, null)
      }
    }
    let i
    for (i = 0; i < structure.length; i ++) {
      let current = structure[i]
      let currentElement = domElement.childNodes[i]
      if (!currentElement) {
        domElement.appendChild(replacementElementFromCurrentStructure(current))
        continue
      }
      if (!current || !current.type) {
        this.recycleNode(currentElement)
        domElement.replaceChild(replacementElementFromCurrentStructure(current), currentElement)
        continue
      }
      switch (current.type) {
        case 'text':
          if (currentElement.nodeName.toLowerCase() === 'p'
              && currentElement.innerHTML === this.normalizeHTML(current.html)) continue
          else {
            this.recycleNode(currentElement)
            domElement.replaceChild(replacementElementFromCurrentStructure(current), currentElement)
          }
          break
        default:
          processEditorNode(current, currentElement)
      }
    }
    // i == structure.length
    while (domElement.childNodes.length > i) {
      let node = domElement.childNodes[i]
      this.recycleNode(node)
      node.remove()
    }
    if (document.activeElement === domElement) {
      document.execCommand('insertBrOnReturn', null, false)
    }
    this.currentDOMStructure = structure
    // TODO: call this.recycleNode for node disappeared.

    this.currentEditorNodes.forEach((comp, node) => {
      if (!touchedEditorNodes.has(node)) {
        this.recycleNode(node)
        console.log('node gc')
      }
    })
  }

  handleInput (evt) {
    if (this.props.onChange) {
      if (!this.editorDOM) return
      if (evt && evt.target !== this.editorDOM) return
      let structure = this.dom2structure(this.editorDOM)
      this.props.onChange(structure)
    }
  }
  execCommandDirect (cmd) {
    let ele = this.editorDOM
    if (this.commandBtnDisabled(cmd)) return
    document.execCommand('styleWithCSS', null, false)
    document.execCommand(cmd)
    this.handleInput()
  }
  commandBtnDisabled (cmd) {
    let ele = this.editorDOM
    if (!ele || document.activeElement !== ele || (document.queryCommandEnabled && !document.queryCommandEnabled(cmd))) return true
    return false
  }
  canInsertNow () {
    let ele = this.editorDOM
    if (!ele || document.activeElement !== ele) return false
    let sel = window.getSelection()
    if (sel.rangeCount !== 1) return false
    if (document.queryCommandEnabled && !document.queryCommandEnabled('insertHTML')) return false
      // Although this command is not used, queryCommandEnabled can be used to test if the cursor is in areas editable.
    return true
  }
  insertEditorNode (type) {
    if (!this.canInsertNow(type)) return
    let sel = window.getSelection()
    if (sel.rangeCount > 0) {
      let range = sel.getRangeAt(0)
      range.collapse(false)
      let newNode = document.createElement('div')
      newNode.dataset.editornode = 'true'
      newNode.dataset.enType = type
      newNode.contentEditable = 'false'
      range.insertNode(newNode)
      this.handleInput()
    }
  }

  render () {
    let commandBtnClass = cmd => cmd + (this.commandBtnDisabled(cmd) ? ' disabled' : '')
    let canInsertBtnClass = cmd => cmd + (!this.canInsertNow(cmd) ? ' disabled' : '')
    return (
      <div className='collectionEditor'>
        <div className='sidebar' onMouseDown={evt => evt.preventDefault()}>
          <div className='description'>Aa</div>
          <div className={commandBtnClass('bold')} title='bold' onClick={evt => this.execCommandDirect('bold')}><b>B</b></div>
          <div className={commandBtnClass('italic')} title='italic' onClick={evt => this.execCommandDirect('italic')}><i>I</i></div>
          <div className={commandBtnClass('strikeThrough')} title='strike through' onClick={evt => this.execCommandDirect('strikeThrough')}><s>D</s></div>
          <div className={commandBtnClass('underline')} title='underline' onClick={evt => this.execCommandDirect('underline')}><u>U</u></div>
          <div className='description'>+</div>
          <div className={canInsertBtnClass('hider')} title='hider' onClick={evt => this.insertEditorNode('hider')}>
            <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
          </div>
          <div className={canInsertBtnClass('paperCrop')} title='paper crop' onClick={evt => this.insertEditorNode('paperCrop')}>
            <svg className="icon ii-crop"><use href="#ii-crop" xlinkHref="#ii-crop" /></svg>
          </div>
        </div>
        <div
          className={'content' + (this.props.disabled ? ' disabled' : '')}
          contentEditable={this.props.disabled ? 'false' : 'true'}
          ref={f => this.editorDOM = f}
          onInput={this.handleInput} />
      </div>
    )
  }
}

module.exports = { Editor }
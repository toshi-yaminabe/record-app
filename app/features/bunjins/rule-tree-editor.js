'use client'

import { useState } from 'react'
import { useApi } from '../../hooks/use-api'

let nextTempId = -1
const genTempId = () => nextTempId--

function cloneTree(node) {
  if (!node) return null
  return {
    ...node,
    children: node.children ? node.children.map(cloneTree) : [],
  }
}

function updateNodeInTree(root, targetId, updater) {
  if (!root) return root
  if (root.id === targetId) return updater(root)
  return {
    ...root,
    children: root.children
      ? root.children.map(child => updateNodeInTree(child, targetId, updater))
      : [],
  }
}

function deleteNodeFromTree(root, targetId) {
  if (!root) return root
  return {
    ...root,
    children: root.children
      ? root.children
          .filter(child => child.id !== targetId)
          .map(child => deleteNodeFromTree(child, targetId))
      : [],
  }
}

function addChildToNode(root, targetId) {
  const newChild = { id: genTempId(), label: '新しいノード', type: null, children: [] }
  return updateNodeInTree(root, targetId, node => ({
    ...node,
    children: [...(node.children || []), newChild],
  }))
}

function TreeNode({ node, onEdit, onDelete, onAddChild }) {
  const [editing, setEditing] = useState(false)
  const [labelInput, setLabelInput] = useState(node.label)

  const handleEditConfirm = () => {
    onEdit(node.id, labelInput)
    setEditing(false)
  }

  const handleEditCancel = () => {
    setLabelInput(node.label)
    setEditing(false)
  }

  return (
    <div className="tree-node">
      <div className="tree-node-content">
        {editing ? (
          <div className="tree-node-edit">
            <input
              className="tree-node-input"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleEditConfirm()
                if (e.key === 'Escape') handleEditCancel()
              }}
              autoFocus
            />
            <button className="btn-xs btn-confirm" onClick={handleEditConfirm}>OK</button>
            <button className="btn-xs btn-cancel" onClick={handleEditCancel}>×</button>
          </div>
        ) : (
          <>
            <span className="tree-node-label">{node.label}</span>
            {node.type && <span className="tree-node-type">{node.type}</span>}
            <div className="tree-node-actions">
              <button className="btn-xs btn-edit" onClick={() => setEditing(true)}>編集</button>
              <button className="btn-xs btn-add" onClick={() => onAddChild(node.id)}>+ 子</button>
              <button className="btn-xs btn-delete" onClick={() => onDelete(node.id)}>削除</button>
            </div>
          </>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-node-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function RuleTreeEditor({ ruleTree }) {
  const { fetchApi, loading } = useApi()
  const [root, setRoot] = useState(() => cloneTree(ruleTree?.root ?? null))

  if (!root) {
    return (
      <div className="rule-tree-empty">
        <p>ルールツリーがありません</p>
      </div>
    )
  }

  const handleEdit = (nodeId, newLabel) => {
    setRoot(prev => updateNodeInTree(prev, nodeId, node => ({ ...node, label: newLabel })))
  }

  const handleDelete = (nodeId) => {
    if (root.id === nodeId) return
    setRoot(prev => deleteNodeFromTree(prev, nodeId))
  }

  const handleAddChild = (nodeId) => {
    setRoot(prev => addChildToNode(prev, nodeId))
  }

  const handleSave = async () => {
    try {
      await fetchApi('/api/rule-trees', {
        method: 'PUT',
        body: JSON.stringify({ root }),
      })
      alert('保存しました')
    } catch (err) {
      alert('保存に失敗しました: ' + err.message)
    }
  }

  const handlePublish = async () => {
    try {
      await fetchApi('/api/rule-trees/publish', { method: 'POST' })
      alert('公開しました')
    } catch (err) {
      alert('公開に失敗しました: ' + err.message)
    }
  }

  return (
    <div className="rule-tree-editor">
      <div className="rule-tree-toolbar">
        <h4>ルールツリー</h4>
        <div className="rule-tree-actions">
          <button className="btn-save" onClick={handleSave} disabled={loading}>
            {loading ? '処理中...' : '保存'}
          </button>
          <button className="btn-publish" onClick={handlePublish} disabled={loading}>
            公開
          </button>
        </div>
      </div>
      <div className="rule-tree-content">
        <TreeNode
          node={root}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddChild={handleAddChild}
        />
      </div>
    </div>
  )
}

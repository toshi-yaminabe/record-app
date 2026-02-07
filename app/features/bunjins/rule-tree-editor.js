'use client'

export function RuleTreeEditor({ ruleTree }) {
  if (!ruleTree || !ruleTree.root) {
    return (
      <div className="rule-tree-empty">
        <p>ルールツリーがありません</p>
      </div>
    )
  }

  const renderNode = (node, depth = 0) => {
    if (!node) return null

    return (
      <div key={node.id} className="tree-node" style={{ '--depth': depth }}>
        <div className="tree-node-content">
          <span className="tree-node-label">{node.label}</span>
          {node.type && <span className="tree-node-type">{node.type}</span>}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="tree-node-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rule-tree-editor">
      <h4>ルールツリー</h4>
      <div className="rule-tree-content">
        {renderNode(ruleTree.root)}
      </div>
    </div>
  )
}

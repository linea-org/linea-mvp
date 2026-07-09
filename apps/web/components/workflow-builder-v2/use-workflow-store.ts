import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react'

export interface WorkflowState {
  nodes: Node[]
  edges: Edge[]
  history: Array<{ nodes: Node[]; edges: Edge[] }>
  historyIndex: number
  
  // Actions
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  
  // History
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  history: [],
  historyIndex: -1,

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
    get().pushHistory()
  },

  setNodes: (nodesUpdater) => {
    set((state) => ({
      nodes: typeof nodesUpdater === 'function' ? nodesUpdater(state.nodes) : nodesUpdater
    }))
  },

  setEdges: (edgesUpdater) => {
    set((state) => ({
      edges: typeof edgesUpdater === 'function' ? edgesUpdater(state.edges) : edgesUpdater
    }))
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ 
      nodes: nodes.map(n => ({ ...n })), 
      edges: edges.map(e => ({ ...e })) 
    })
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      const snap = history[newIndex]
      if (snap) {
        set({
          nodes: snap.nodes,
          edges: snap.edges,
          historyIndex: newIndex
        })
      }
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const snap = history[newIndex]
      if (snap) {
        set({
          nodes: snap.nodes,
          edges: snap.edges,
          historyIndex: newIndex
        })
      }
    }
  }
}))

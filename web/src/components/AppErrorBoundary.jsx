import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: ''
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error.'
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg shadow-sm p-6">
            <h1 className="text-xl font-bold text-red-700 mb-2">Page failed to load</h1>
            <p className="text-sm text-slate-700 mb-4">
              The app hit an unexpected error while rendering this view.
            </p>
            <p className="text-xs text-slate-500 break-words">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
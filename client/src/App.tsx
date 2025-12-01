import { DeviceProvider } from './contexts/DeviceContext'

const App = () => {
  return (
    <DeviceProvider>
      <div>App</div>
    </DeviceProvider>
  )
}

export default App
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import Menu from './pages/menu'
import { DeviceProvider } from './contexts/DeviceContext'
import { Toaster } from './components/ui/toaster' 

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DeviceProvider>
        <Menu />
        <Toaster />
      </DeviceProvider>
    </QueryClientProvider>
  )
}

export default App
import PreferencesStep from './components/menu-scanner/PreferencesStep'
import { DeviceProvider } from './contexts/DeviceContext'
import { Toaster } from './components/ui/toaster' 

const App = () => {
  return (
    <DeviceProvider>
      <PreferencesStep 
        preferences={{
          dietary: [],
          cuisines: [],
          allergies: [],
          flavors: [],
          dislikedIngredients: []
        }} 
        onSubmit={() => {}} 
        isLoading={false} 
      />
      <Toaster />
    </DeviceProvider>
  )
}

export default App
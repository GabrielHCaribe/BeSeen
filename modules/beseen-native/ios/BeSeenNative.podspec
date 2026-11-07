Pod::Spec.new do |s|
  s.name           = 'BeSeenNative'
  s.version        = '1.0.0'
  s.summary        = 'BeSeen blocking, limits and check-ins'
  s.description    = 'Screen Time (FamilyControls, ManagedSettings, DeviceActivity) integration for BeSeen'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end

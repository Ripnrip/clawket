require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'ClawketNearbyDiscovery'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = package['author']
  s.homepage = package['homepage']
  s.platforms = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.swift_version = '5.9'
  s.source = { git: package['homepage'], tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = ['Network']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
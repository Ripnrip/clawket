    import UIKit

    class SceneDelegate: UIResponder, UIWindowSceneDelegate {

        var window: UIWindow?

        func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
            // Scene setup (e.g., initial view controller)
            guard let windowScene = scene as? UIWindowScene else { return }
            window = UIWindow(windowScene: windowScene)
            // Assign your root view controller (e.g., from AppDelegate or React Native entry point)
            window?.rootViewController = UIViewController() // Replace with your app's root (e.g., from Expo)
            window?.makeKeyAndVisible()
        }

        func sceneDidDisconnect(_ scene: UIScene) {
            // Cleanup when scene disconnects
        }

        func sceneDidBecomeActive(_ scene: UIScene) {
            // App became active
        }

        func sceneWillResignActive(_ scene: UIScene) {
            // App will resign active
        }

        func sceneWillEnterForeground(_ scene: UIScene) {
            // App entering foreground
        }

        func sceneDidEnterBackground(_ scene: UIScene) {
            // App entered background
        }
    }

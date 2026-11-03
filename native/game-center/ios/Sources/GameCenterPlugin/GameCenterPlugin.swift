import Foundation
import Capacitor
import GameKit

/// Straitwatch's Game Center bridge: sign the local player in, submit a best
/// score to a map's leaderboard, report achievements, and show the dashboard.
/// Every call resolves (never hangs) so the game is never held up by Game
/// Center; a player who is not signed in just gets no-ops.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDashboard", returnType: CAPPluginReturnPromise)
    ]

    private var pendingAuth: [CAPPluginCall] = []
    private var authStarted = false

    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["authenticated": true])
            return
        }
        pendingAuth.append(call)
        if authStarted { return }
        authStarted = true
        DispatchQueue.main.async {
            player.authenticateHandler = { [weak self] viewController, _ in
                guard let self = self else { return }
                if let vc = viewController {
                    // Apple's sign-in sheet: shown once, over the game.
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                let ok = GKLocalPlayer.local.isAuthenticated
                let calls = self.pendingAuth
                self.pendingAuth.removeAll()
                for c in calls { c.resolve(["authenticated": ok]) }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve()
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func reportAchievement(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("id is required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve()
            return
        }
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = call.getDouble("percent") ?? 100
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func showDashboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, let host = self.bridge?.viewController else {
                call.resolve()
                return
            }
            let vc = GKGameCenterViewController(state: .dashboard)
            vc.gameCenterDelegate = self
            host.present(vc, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}

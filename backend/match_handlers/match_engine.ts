import { MatchObject, MatchPlayer, MoveRequest, GameCard, ChaosEffectName } from './types'
import { validateAction } from './game_modes_rules'



export type ActionEvent = { type: string; [key: string]: unknown }

export type ActionResult = {
    ok: boolean
    message?: string
    events: ActionEvent[]
}



//  Main dispatch

export function executeAction(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    if (match.winner_id) {
        return { ok: false, message: 'This match is already over', events: [] }
    }

    const validation = validateAction(match, player, request)
    if (!validation.ok) {
        return { ok: false, message: (validation as { ok: false; message: string }).message, events: [] }
    }
}



export function buildPlayerView(match: MatchObject, viewerPlayerId: string) {
    return {}
}
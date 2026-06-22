import { MatchObject, MatchPlayer, MoveRequest, GameCard, ChaosEffectName } from './types'
import { triggerAbilities, AbilityEvent } from './abilities'
import { validateAction } from './game_modes_rules'

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult = {
    ok: boolean
    message?: string
    events: ActionEvent[]
}

export type ActionEvent = { type: string; [key: string]: unknown }

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getOpponent(match: MatchObject, player: MatchPlayer): MatchPlayer {
    return match.players.find(p => p.id !== player.id)!
}

function cardFromBoard(player: MatchPlayer, uuid: string): GameCard | undefined {
    return (
        player.table_cards.find(c => c.uuid === uuid) ??
        player.defense_cards?.find(c => c.uuid === uuid)
    )
}

function removeDeadCards(player: MatchPlayer): ActionEvent[] {
    const events: ActionEvent[] = []
    const zones: (keyof MatchPlayer)[] = ['table_cards', 'defense_cards', 'master_cards']
    for (const zone of zones) {
        const arr = player[zone] as GameCard[] | undefined
        if (!arr) continue
        const dead = arr.filter(c => c.life <= 0)
        for (const c of dead) events.push({ type: 'card_died', uuid: c.uuid, owner_id: player.id })
        ;(player[zone] as GameCard[]) = arr.filter(c => c.life > 0)
    }
    return events
}

// ─── Win condition ────────────────────────────────────────────────────────────

export function checkWinCondition(match: MatchObject): string | null {
    const [p0, p1] = match.players

    switch (match.mode) {
        case 'classic':
        case 'destiny':
        case 'dungeon_run':
            if (p0.hero_card && p0.hero_card.life <= 0) return p1.id
            if (p1.hero_card && p1.hero_card.life <= 0) return p0.id
            break

        case 'eclipse':
            if ((p0.life_pool ?? 30) <= 0) return p1.id
            if ((p1.life_pool ?? 30) <= 0) return p0.id
            break

        case 'chaos':
            // Win by destroying ALL master cards; defense zone state is irrelevant
            if (!p0.master_cards || p0.master_cards.length === 0) return p1.id
            if (!p1.master_cards || p1.master_cards.length === 0) return p0.id
            break

        case 'ritual':
            if ((p0.soul_vessel_life ?? 20) <= 0) return p1.id
            if ((p1.soul_vessel_life ?? 20) <= 0) return p0.id
            break
    }

    // Destiny: Judge's Verdict (3 consecutive favorable Action Die rolls ≥ 4)
    if (match.mode === 'destiny' && (match.favorable_rolls_streak ?? 0) >= 3) {
        return match.players[match.current_turn_player].id
    }

    return null
}

// ─── Chaos deck ───────────────────────────────────────────────────────────────

const ALL_CHAOS_EFFECTS: ChaosEffectName[] = [
    'earthquake', 'mass_confusion', 'blood_moon', 'surge', 'silence',
    'second_wind', 'the_cull', 'mirror', 'void_rift',
]

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function drawFromChaosDeck(match: MatchObject): ChaosEffectName[] {
    const count = match.chaos_draws_per_turn ?? 1
    const drawn: ChaosEffectName[] = []

    for (let i = 0; i < count; i++) {
        if (!match.chaos_deck || match.chaos_deck.length === 0) {
            match.chaos_deck_exhausted_count = (match.chaos_deck_exhausted_count ?? 0) + 1
            match.chaos_deck = shuffle(ALL_CHAOS_EFFECTS)
            // From the third reshuffle onwards draw two cards per turn
            if ((match.chaos_deck_exhausted_count ?? 0) >= 3) {
                match.chaos_draws_per_turn = 2
            }
        }
        drawn.push(match.chaos_deck.shift()!)
    }
    return drawn
}

function applyChaosEffect(effect: ChaosEffectName, match: MatchObject): ActionEvent[] {
    const [p0, p1] = match.players
    const events: ActionEvent[] = [{ type: 'chaos_effect', effect }]

    // Reset previous temporaries
    match.blood_moon_active = false
    match.mass_confusion_active = false
    match.silence_active = false
    match.surge_active = false
    match.void_rift_active = false

    switch (effect) {
        case 'earthquake':
            for (const p of [p0, p1]) {
                for (const card of p.table_cards) card.life -= 2
                for (const card of p.defense_cards ?? []) card.life -= 2
                events.push(...removeDeadCards(p))
            }
            break

        case 'mass_confusion': {
            match.mass_confusion_active = true
            const tmp0 = p0.table_cards
            const tmp1 = p1.table_cards
            p0.table_cards = tmp1
            p1.table_cards = tmp0
            break
        }

        case 'blood_moon':
            match.blood_moon_active = true
            break

        case 'surge':
            match.surge_active = true
            for (const p of [p0, p1]) {
                for (const card of [...p.table_cards, ...(p.defense_cards ?? [])]) {
                    card.attack_damage += 2
                }
            }
            break

        case 'silence':
            match.silence_active = true
            break

        case 'second_wind':
            for (const p of [p0, p1]) p.mana_level = p.mana_capacity
            break

        case 'the_cull':
            for (const p of [p0, p1]) {
                const zone = [...p.table_cards, ...(p.defense_cards ?? [])]
                if (zone.length === 0) continue
                const weakest = zone.reduce((min, c) => c.life < min.life ? c : min, zone[0])
                p.table_cards = p.table_cards.filter(c => c.uuid !== weakest.uuid)
                if (p.defense_cards) p.defense_cards = p.defense_cards.filter(c => c.uuid !== weakest.uuid)
                events.push({ type: 'card_died', uuid: weakest.uuid, owner_id: p.id, cause: 'the_cull' })
            }
            break

        case 'mirror':
            // Each player gives one random hand card to the opponent
            for (const p of [p0, p1]) {
                const opp = p.id === p0.id ? p1 : p0
                if (p.hand_cards.length === 0) continue
                const idx = Math.floor(Math.random() * p.hand_cards.length)
                opp.hand_cards.push(p.hand_cards.splice(idx, 1)[0])
            }
            break

        case 'void_rift': {
            match.void_rift_active = true
            // Temporarily swap the players' life target values
            if (p0.hero_card && p1.hero_card) {
                const tmp = p0.hero_card.life;
                p0.hero_card.life = p1.hero_card.life;
                p1.hero_card.life = tmp
            } else if (p0.soul_vessel_life !== undefined && p1.soul_vessel_life !== undefined) {
                const tmp = p0.soul_vessel_life;
                p0.soul_vessel_life = p1.soul_vessel_life;
                p1.soul_vessel_life = tmp
            } else if (p0.life_pool !== undefined && p1.life_pool !== undefined) {
                const tmp = p0.life_pool;
                p0.life_pool = p1.life_pool;
                p1.life_pool = tmp
            }
            break
        }
    }

    return events
}

function revertChaosTemporaryEffects(match: MatchObject): void {
    const effect = match.current_chaos_effect
    if (!effect) return
    const [p0, p1] = match.players

    if (effect === 'mass_confusion') {
        const tmp = p0.table_cards
        p0.table_cards = p1.table_cards
        p1.table_cards = tmp
    }

    if (effect === 'surge') {
        for (const p of [p0, p1]) {
            for (const card of [...p.table_cards, ...(p.defense_cards ?? [])]) {
                card.attack_damage = Math.max(0, card.attack_damage - 2)
            }
        }
    }

    if (effect === 'void_rift') {
        if (p0.hero_card && p1.hero_card) {
            const tmp = p0.hero_card.life;
            p0.hero_card.life = p1.hero_card.life;
            p1.hero_card.life = tmp
        } else if (p0.soul_vessel_life !== undefined && p1.soul_vessel_life !== undefined) {
            const tmp = p0.soul_vessel_life;
            p0.soul_vessel_life = p1.soul_vessel_life;
            p1.soul_vessel_life = tmp
        } else if (p0.life_pool !== undefined && p1.life_pool !== undefined) {
            const tmp = p0.life_pool;
            p0.life_pool = p1.life_pool;
            p1.life_pool = tmp
        }
    }

    match.blood_moon_active = false
    match.mass_confusion_active = false
    match.silence_active = false
    match.surge_active = false
    match.void_rift_active = false
}

// ─── Turn transition ──────────────────────────────────────────────────────────

export function endTurnAndStartNext(match: MatchObject): ActionEvent[] {
    const events: ActionEvent[] = []
    const prevIdx = match.current_turn_player
    let nextIdx: 0 | 1 = prevIdx === 0 ? 1 : 0

    // ── Chaos: revert temporaries from the turn that just ended ──────────────
    if (match.mode === 'chaos') revertChaosTemporaryEffects(match)

    // ── Eclipse timer ─────────────────────────────────────────────────────────
    if (match.mode === 'eclipse' && !match.eclipse_active) {
        match.eclipse_timer = (match.eclipse_timer ?? 12) - 1
        events.push({ type: 'eclipse_timer_tick', timer: match.eclipse_timer })

        if ((match.eclipse_timer ?? 0) <= 0) {
            match.eclipse_active = true
            // Lock mana capacity to whatever both players have now
            match.mana_cap_at_eclipse = match.players[nextIdx].mana_capacity

            // Double all minion stats on the board at the moment Eclipse triggers
            for (const p of match.players) {
                for (const card of p.table_cards) {
                    card.attack_damage *= 2
                    card.life *= 2
                    card.max_life *= 2
                }
            }
            events.push({ type: 'eclipse_phase_started' })
        }
    }

    // ── Destiny: Reversal Coin every third turn ────────────────────────────────
    if (match.mode === 'destiny') {
        match.reversal_coin_counter = ((match.reversal_coin_counter ?? 0) + 1) % 3
        if (match.reversal_coin_counter === 0 && Math.random() < 0.5) {
            // Reversal: the delayed player gets the turn again next cycle
            // (in practice we just keep nextIdx as prevIdx to repeat the turn)
            nextIdx = prevIdx
            events.push({ type: 'destiny_reversal', affected_player_id: match.players[prevIdx].id })
        }
    }

    match.total_turns_count += 1
    match.current_turn_player = nextIdx
    const nextPlayer = match.players[nextIdx]

    // ── Mana restore ──────────────────────────────────────────────────────────
    if (match.mode === 'eclipse' && match.eclipse_active && match.mana_cap_at_eclipse !== undefined) {
        nextPlayer.mana_capacity = match.mana_cap_at_eclipse
    } else {
        nextPlayer.mana_capacity = Math.min((nextPlayer.mana_capacity ?? 1) + 1, 16)
    }
    nextPlayer.mana_level = nextPlayer.mana_capacity
    events.push({ type: 'mana_restored', player_id: nextPlayer.id, mana_level: nextPlayer.mana_level, mana_capacity: nextPlayer.mana_capacity })

    // ── Lift summoning sickness ───────────────────────────────────────────────
    for (const card of [...nextPlayer.table_cards, ...(nextPlayer.defense_cards ?? []), ...(nextPlayer.master_cards ?? [])]) {
        card.can_attack = true
    }

    // ── Colossal regen (passive ability: restore 2 hp per turn) ───────────────
    for (const card of nextPlayer.table_cards) {
        if (card.abilities?.some(a => a.name === 'colossal_regen')) {
            const healed = Math.min(card.max_life - card.life, 2)
            card.life += healed
            if (healed > 0) events.push({ type: 'card_healed', uuid: card.uuid, amount: healed })
        }
    }

    // ── Eclipse per-turn damage ───────────────────────────────────────────────
    if (match.mode === 'eclipse' && match.eclipse_active) {
        for (const p of match.players) {
            let dmg = 2
            if (p.table_cards.length === 0) dmg += 3  // empty board penalty
            p.life_pool = (p.life_pool ?? 30) - dmg
            events.push({ type: 'eclipse_damage', player_id: p.id, amount: dmg })
        }
    }

    // ── Destiny dice roll for the incoming turn ────────────────────────────────
    if (match.mode === 'destiny') {
        match.action_die = Math.ceil(Math.random() * 6)
        match.fate_die   = Math.ceil(Math.random() * 4)
        events.push({ type: 'destiny_dice_rolled', action_die: match.action_die, fate_die: match.fate_die, player_id: nextPlayer.id })

        // Judge's Verdict tracker
        if (match.action_die >= 4) {
            match.favorable_rolls_streak = (match.favorable_rolls_streak ?? 0) + 1
        } else {
            match.favorable_rolls_streak = 0
        }

        if ((match.favorable_rolls_streak ?? 0) === 2) {
            events.push({ type: 'destiny_verdict_warning', player_id: nextPlayer.id })
        }
    }

    // ── Chaos: draw and apply effect for the incoming turn ────────────────────
    if (match.mode === 'chaos') {
        const drawn = drawFromChaosDeck(match)
        for (const effect of drawn) {
            match.current_chaos_effect = effect
            events.push(...applyChaosEffect(effect, match))
        }
    }

    events.push({ type: 'turn_started', player_id: nextPlayer.id, turn: match.total_turns_count })
    return events
}

// ─── Action executors ─────────────────────────────────────────────────────────

function executeThrowOntoTable(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const opponent = getOpponent(match, player)
    const card = player.hand_cards.find(c => c.uuid === request.card!.uuid)!

    player.hand_cards = player.hand_cards.filter(c => c.uuid !== card.uuid)
    card.can_attack = false
    player.mana_level -= card.mana_cost

    if (match.mode === 'chaos') {
        if (!player.defense_cards) player.defense_cards = []
        player.defense_cards.push(card)
    } else {
        player.table_cards.push(card)
    }

    const events: ActionEvent[] = [{ type: 'card_played', player_id: player.id, card }]

    // Fire on_play abilities, suppressed during Chaos Silence
    if (!match.silence_active) {
        const abilityEvents = triggerAbilities('on_play', card, match, player, opponent)
        events.push(...(abilityEvents as ActionEvent[]))

        // Ability effects can kill enemy cards
        events.push(...removeDeadCards(opponent))
    }

    return { ok: true, events }
}

function executeAttackCard(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const opponent = getOpponent(match, player)
    const attacker = cardFromBoard(player, request.card!.uuid)!
    const events: ActionEvent[] = []

    // Find target across all opponent zones
    let targetZone: GameCard[] | undefined
    let target: GameCard | undefined

    // In Chaos, defense zone must be cleared before master zone can be attacked
    if (match.mode === 'chaos') {
        if (opponent.defense_cards && opponent.defense_cards.length > 0) {
            target = opponent.defense_cards.find(c => c.uuid === request.target_uuid)
            if (target) targetZone = opponent.defense_cards
            else return { ok: false, message: 'Must destroy all defending cards before attacking master cards', events: [] }
        } else {
            target = opponent.master_cards?.find(c => c.uuid === request.target_uuid)
            if (target) targetZone = opponent.master_cards
        }
    } else {
        target = opponent.table_cards.find(c => c.uuid === request.target_uuid)
        if (target) targetZone = opponent.table_cards
    }

    if (!target || !targetZone) return { ok: false, message: 'Target not found', events: [] }

    const atkDamage = match.blood_moon_active ? 1 : attacker.attack_damage
    const defDamage = match.blood_moon_active ? 1 : target.attack_damage

    attacker.life -= defDamage
    target.life   -= atkDamage
    attacker.can_attack = false

    events.push({ type: 'combat', attacker_uuid: attacker.uuid, target_uuid: target.uuid, attacker_took: defDamage, target_took: atkDamage })

    // Remove dead cards
    events.push(...removeDeadCards(player))
    events.push(...removeDeadCards(opponent))

    // Eclipse: player just cleared all opponent minions → reset timer
    if (match.mode === 'eclipse' && opponent.table_cards.length === 0) {
        const resetCount = (match.eclipse_reset_count ?? 0) + 1
        match.eclipse_reset_count = resetCount
        const newTimer = Math.max(6 - (resetCount - 1), 2)
        match.eclipse_timer = newTimer
        match.eclipse_active = false
        events.push({ type: 'eclipse_timer_reset', new_value: newTimer })
    }

    return { ok: true, events }
}

function executeAttackHero(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const opponent = getOpponent(match, player)
    const attacker = cardFromBoard(player, request.card!.uuid)!
    const damage = match.blood_moon_active ? 1 : attacker.attack_damage

    opponent.hero_card!.life -= damage
    attacker.can_attack = false

    return {
        ok: true,
        events: [{ type: 'hero_damaged', player_id: opponent.id, amount: damage, attacker_uuid: attacker.uuid }]
    }
}

function executeAttackLifePool(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const opponent = getOpponent(match, player)
    const attacker = cardFromBoard(player, request.card!.uuid)!
    const damage = match.blood_moon_active ? 1 : attacker.attack_damage

    opponent.life_pool = (opponent.life_pool ?? 30) - damage
    attacker.can_attack = false

    return {
        ok: true,
        events: [{ type: 'life_pool_damaged', player_id: opponent.id, amount: damage, attacker_uuid: attacker.uuid }]
    }
}

function executeSacrificeCard(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const card = player.hand_cards.find(c => c.uuid === request.card!.uuid)!
    player.hand_cards = player.hand_cards.filter(c => c.uuid !== card.uuid)
    player.ritual_energy = (player.ritual_energy ?? 3) + card.mana_cost

    return {
        ok: true,
        events: [{ type: 'card_sacrificed', player_id: player.id, card, energy_gained: card.mana_cost, total_energy: player.ritual_energy }]
    }
}

const RITUAL_SPELL_COSTS: Record<string, number> = {
    bloodbind: 5,           ashen_strike: 5,
    soul_harvest: 12,       purge: 12,          rebirth: 12,
    dark_convergence: 22,   summon_from_deep: 22,
    annihilation: 35,       necromancy_curse: 35,
}

function executeCastRitualSpell(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const opponent = getOpponent(match, player)
    const spell = request.spell_name!
    const cost = RITUAL_SPELL_COSTS[spell]

    player.ritual_energy = (player.ritual_energy ?? 0) - cost
    const events: ActionEvent[] = [{ type: 'ritual_cast', player_id: player.id, spell, energy_spent: cost, energy_remaining: player.ritual_energy }]

    switch (spell) {
        case 'bloodbind':
            player.soul_vessel_life = Math.min((player.soul_vessel_life ?? 20) + 6, 20)
            events.push({ type: 'soul_vessel_healed', player_id: player.id, amount: 6 })
            break

        case 'ashen_strike': {
            // If target_uuid points to a minion, hit it; otherwise hit the soul vessel
            const target = request.target_uuid ? opponent.table_cards.find(c => c.uuid === request.target_uuid) : undefined
            if (target) {
                target.life -= 4
                events.push({ type: 'card_damaged', uuid: target.uuid, damage: 4 })
                events.push(...removeDeadCards(opponent))
            } else {
                opponent.soul_vessel_life = (opponent.soul_vessel_life ?? 20) - 4
                events.push({ type: 'soul_vessel_damaged', player_id: opponent.id, amount: 4 })
            }
            break
        }

        case 'soul_harvest':
            events.push({ type: 'draw_cards', player_id: player.id, count: 3 })
            break

        case 'purge': {
            const target = opponent.table_cards.find(c => c.uuid === request.target_uuid)
            if (target) {
                opponent.table_cards = opponent.table_cards.filter(c => c.uuid !== target.uuid)
                events.push({ type: 'card_died', uuid: target.uuid, owner_id: opponent.id, cause: 'purge' })
            }
            break
        }

        case 'rebirth':
            events.push({ type: 'rebirth_triggered', player_id: player.id })
            break

        case 'dark_convergence':
            for (const card of opponent.table_cards) {
                card.life -= 3
                events.push({ type: 'card_damaged', uuid: card.uuid, damage: 3 })
            }
            opponent.soul_vessel_life = (opponent.soul_vessel_life ?? 20) - 3
            events.push(...removeDeadCards(opponent))
            events.push({ type: 'soul_vessel_damaged', player_id: opponent.id, amount: 3 })
            break

        case 'summon_from_deep':
            events.push({ type: 'summon_from_deep', player_id: player.id })
            break

        case 'annihilation':
            for (const p of match.players) {
                for (const card of p.table_cards) events.push({ type: 'card_died', uuid: card.uuid, owner_id: p.id, cause: 'annihilation' })
                p.table_cards = []
            }
            break

        case 'necromancy_curse':
            events.push({ type: 'necromancy_curse_triggered', player_id: player.id })
            break
    }

    return { ok: true, events }
}

function executeChooseHeroCard(match: MatchObject, player: MatchPlayer, request: MoveRequest): ActionResult {
    const card = player.hand_cards.find(c => c.uuid === request.card!.uuid)!

    player.hero_card = { ...card, life: 30, max_life: 30, is_hero: true }
    player.hand_cards = player.hand_cards.filter(c => c.uuid !== card.uuid)

    return {
        ok: true,
        events: [{ type: 'hero_chosen', player_id: player.id, card: player.hero_card }]
    }
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export function executeAction(
    match: MatchObject,
    player: MatchPlayer,
    request: MoveRequest
): ActionResult {
    if (match.winner_id) {
        return { ok: false, message: 'This match is already over', events: [] }
    }

    // Validate before mutating any state
    const validation = validateAction(match, player, request)
    if (!validation.ok) {
        return { ok: false, message: (validation as { ok: false; message: string }).message, events: [] }
    }

    let result: ActionResult

    switch (request.action) {
        case 'throw_onto_table':   result = executeThrowOntoTable(match, player, request); break
        case 'attack_card':        result = executeAttackCard(match, player, request);      break
        case 'attack_hero':        result = executeAttackHero(match, player, request);      break
        case 'attack_life_pool':   result = executeAttackLifePool(match, player, request);  break
        case 'sacrifice_card':     result = executeSacrificeCard(match, player, request);   break
        case 'cast_ritual_spell':  result = executeCastRitualSpell(match, player, request); break
        case 'choose_hero_card':   result = executeChooseHeroCard(match, player, request);  break
        case 'end_turn': {
            const turnEvents = endTurnAndStartNext(match)
            result = { ok: true, events: turnEvents }
            break
        }
        default:
            return { ok: false, message: `Unknown action: ${request.action}`, events: [] }
    }

    if (!result.ok) return result

    // Check win condition after every successful action
    const winnerId = checkWinCondition(match)
    if (winnerId) {
        match.winner_id = winnerId
        result.events.push({ type: 'match_won', winner_id: winnerId })
    }

    return result
}

// ─── Match state projection (what each player is allowed to see) ──────────────

export function buildPlayerView(match: MatchObject, viewerPlayerId: string) {
    const viewer   = match.players.find(p => p.id === viewerPlayerId)!
    const opponent = match.players.find(p => p.id !== viewerPlayerId)!

    return {
        match_id:             match.match_id,
        mode:                 match.mode,
        is_my_turn:           match.players[match.current_turn_player].id === viewerPlayerId,
        total_turns_count:    match.total_turns_count,
        winner_id:            match.winner_id ?? null,

        // Full self state
        self: {
            id:                viewer.id,
            mana_level:        viewer.mana_level,
            mana_capacity:     viewer.mana_capacity,
            hand_cards:        viewer.hand_cards,
            table_cards:       viewer.table_cards,
            defense_cards:     viewer.defense_cards,
            master_cards:      viewer.master_cards,
            hero_card:         viewer.hero_card,
            soul_vessel_life:  viewer.soul_vessel_life,
            ritual_energy:     viewer.ritual_energy,
            life_pool:         viewer.life_pool,
        },

        // Opponent: hand count hidden, all board cards visible
        opponent: {
            id:                opponent.id,
            nickname:          opponent.nickname,
            mana_level:        opponent.mana_level,
            mana_capacity:     opponent.mana_capacity,
            hand_cards_count:  opponent.hand_cards.length,
            table_cards:       opponent.table_cards,
            defense_cards:     opponent.defense_cards,
            master_cards:      opponent.master_cards,
            hero_card:         opponent.hero_card,
            soul_vessel_life:  opponent.soul_vessel_life,
            ritual_energy:     opponent.ritual_energy,
            life_pool:         opponent.life_pool,
        },

        // Mode-specific shared state
        eclipse_timer:           match.eclipse_timer,
        eclipse_active:          match.eclipse_active,
        action_die:              match.action_die,
        fate_die:                match.fate_die,
        favorable_rolls_streak:  match.favorable_rolls_streak,
        current_chaos_effect:    match.current_chaos_effect,
        blood_moon_active:       match.blood_moon_active,
        silence_active:          match.silence_active,
    }
}

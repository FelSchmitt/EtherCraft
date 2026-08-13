import { CardRarity, EventResult } from "./types"

type TestCardObject = {
    card_id: string
    mana_cost: number
    base_life: number
    attack_damage: number
    classes: { name: string, function?: string, trigger?: EventResult }[]
    abilities: { function: string, trigger: EventResult, replace_default_event: boolean, name?: string, description?: string }[]
    rarity: CardRarity
}



export const testCards: TestCardObject[] = [
    {
        card_id: 'ironwood_ent',
        mana_cost: 1,
        base_life: 5,
        attack_damage: 2,
        classes: [{ name: 'verdant' }, { name: 'thorns', trigger: 'damaged', function: '' }],
        abilities: [],
        rarity: 'uncommon'
    },
    {
        card_id: 'emberveil_assassin',
        mana_cost: 4,
        base_life: 5,
        attack_damage: 2,
        classes: [{ name: 'shadow' }, { name: 'infernal' }],
        abilities: [],
        rarity: 'epic'
    },
    {
        card_id: 'shadow_demon',
        mana_cost: 3,
        base_life: 4,
        attack_damage: 3,
        classes: [{ name: 'spectral' }, { name: 'underworld' }, { name: 'evil' }],
        abilities: [],
        rarity: 'rare'
    },
    {
        card_id: 'primal_rhino',
        mana_cost: 1,
        base_life: 3,
        attack_damage: 2,
        classes: [{ name: 'beast' }, { name: 'primitive' }],
        abilities: [],
        rarity: 'uncommon'
    },
    {
        card_id: 'tide_caller',
        mana_cost: 7,
        base_life: 10,
        attack_damage: 5,
        classes: [{ name: 'titan', trigger: 'damaged', function: '' }, { name: 'elemental' }, { name: 'aquatic' }],
        abilities: [],
        rarity: 'titanic',
    },
    {
        card_id: 'mice_lord',
        mana_cost: 6,
        base_life: 8,
        attack_damage: 5,
        classes: [{ name: 'colossus', trigger: 'turn_changed', function: '' }, { name: 'verdant' }],
        abilities: [],
        rarity: 'colossal',
    },
    {
        card_id: 'eclipse_eye',
        mana_cost: 5,
        base_life: 3,
        attack_damage: 3,
        classes: [],
        abilities: [],
        rarity: 'legendary',
    },
    {
        card_id: 'great_storm_ravager',
        mana_cost: 5,
        base_life: 3,
        attack_damage: 3,
        classes: [{ name: 'titan', trigger: 'damaged', function: '' }, { name: 'elemental' }],
        abilities: [],
        rarity: 'titanic',
    },
]
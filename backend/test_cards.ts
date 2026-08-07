import { CardRarity } from "./types"



export const testCards = [
    {
        card_id: 'ironwood_ent',
        mana_cost: 1,
        base_life: 5,
        attack_damage: 2,
        classes: [{ name: 'verdant' }, { name: 'thorns', trigger: 'damaged' as 'damaged', function: '' }],
        abilities: [],
        rarity: 'uncommon' as CardRarity
    },
    {
        card_id: 'emberveil_assassin',
        mana_cost: 4,
        base_life: 5,
        attack_damage: 2,
        classes: [{ name: 'shadow' }, { name: 'infernal' }],
        abilities: [],
        rarity: 'epic' as CardRarity
    },
    {
        card_id: 'shadow_demon',
        mana_cost: 4,
        base_life: 4,
        attack_damage: 3,
        classes: [{ name: 'spectral' }, { name: 'underworld' }],
        abilities: [],
        rarity: 'rare' as CardRarity
    },
    {
        card_id: 'primal_rhino',
        mana_cost: 1,
        base_life: 3,
        attack_damage: 2,
        classes: [{ name: 'beast' }, { name: 'primitive' }],
        abilities: [],
        rarity: 'uncommon' as CardRarity
    },
]
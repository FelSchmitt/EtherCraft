export default function MatchMenu() {
    async function searchOpponent() {
        const request = await fetch('http://localhost:3001/matches/searchopponent',
            {
                method: 'post',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({access: localStorage.getItem('access')}),
                credentials: 'include'
            }
        )

        const response = await request.json()

        console.log(response)
    }

    return (
        <>
            <div className="w-full flex justify-evenly">
                <div className="">
                    <img src="/images/classic_mode_icon.png" alt="Ícone Modo Clássico" className="w-40" />
                    <p className="text-center text-2xl font-serif">Modo Clássico</p>
                </div>
            </div>
            <button onClick={() => { searchOpponent() }} className="bg-(--goldgray) w-40 h-20 border-4 border-(--gold) font-serif text-[25px] rounded-2xl font-bold duration-300 hover:bg-(--darkgoldgray) hover:cursor-pointer">JOGAR</button>
        </>
    )
}
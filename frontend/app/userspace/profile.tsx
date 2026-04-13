type ProfileData = {
    nickname: string,
    id: string
}

export default function ProfileContent({ nickname, id }: ProfileData) {
    return (
        <>
            <img src={`http://localhost:3001/users/${id}.png`} alt="Profile Image" className="rounded-full w-60 aspect-square mr-4" />
            <div>
                <h1 className="nicknametitle text-6xl">{nickname}</h1>
                <h2 className="text-2xl">{id}</h2>
            </div>
        </>
    )
}
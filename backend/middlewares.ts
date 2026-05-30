import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { pool } from './server'

export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!req.body.access) {
            res.status(401).send({ message: 'not authorized' })
        } else {
            jwt.verify(req.body.access, process.env.SECRET_KEY as string)

            const decodedToken = jwt.decode(req.body.access) as { access_token: string }
            const checkUserQuery = await pool.query(`select * from users where access_token = '${decodedToken.access_token}'`)

            if (checkUserQuery.rowCount === 0) {
                res.status(401).send({ message: 'user does not exist' })
            } else {
                (req as any).user_data = checkUserQuery.rows[0]
                next()
            }
        }
    } catch {
        res.status(401).send({ message: 'invalid token' })
    }
}

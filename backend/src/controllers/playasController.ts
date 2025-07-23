import { Request, Response } from 'express';
import { obtenerPrediccionPorCodigo } from '../services/aemetService';
import { obtenerEstadoCruzRoja } from '../services/cruzRojaService';
import playasCantabria from '../data/playasCantabria.json';

export function listarPlayas(req: Request, res: Response) {
    res.json(playasCantabria);
}

export async function prediccionPlaya(req: Request, res: Response) {
    const { codigo } = req.params;

    const playa = playasCantabria.find(p => p.codigo === codigo);


    if (!playa) {
        return res.status(404).json({ error: 'Playa no encontrada' });
    }

    try {
        const [aemet, cruzRoja] = await Promise.all([
            obtenerPrediccionPorCodigo(codigo),
            obtenerEstadoCruzRoja(playa.idCruzRoja)
        ]);

        res.json({
            nombre: playa.nombre,
            codigo,
            aemet,
            cruzRoja
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener datos combinados' });
    }
}

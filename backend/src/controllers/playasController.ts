import { Request, Response } from 'express';
import { obtenerEstadoCruzRoja } from '../services/cruzRojaService';
import { obtenerPrediccionConFallback } from '../services/prediccionService';
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
        const [prediccion, cruzRoja] = await Promise.all([
            obtenerPrediccionConFallback(codigo),
            obtenerEstadoCruzRoja(playa.idCruzRoja)
        ]);

        res.json({
            nombre: playa.nombre,
            municipio: playa.municipio,
            codigo,
            fuente: prediccion.fuente,
            ultimaActualizacion: prediccion.ultimaActualizacion,
            prediccion: prediccion.prediccion,
            cruzRoja
        });
    } catch (error) {
        console.error('❌ Error al obtener datos combinados:', error);
        res.status(500).json({ error: 'Error al obtener datos combinados' });
    }
}

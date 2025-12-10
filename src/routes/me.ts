import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const initData = req.query.initData as string | undefined;
  // TODO: позже добавить разбор и валидацию initData

  const demoUser = {
    id: 1,
    username: 'demo_user',
    first_name: 'Demo',
    last_name: 'User',
  };

  const profile = {
    user: demoUser,
    starsBalance: 0,
    giftsCount: 0,
    inventory: [],
    initData,
  };

  res.json(profile);
});

export default router;
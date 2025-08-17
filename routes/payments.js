
import express from 'express';
import Stripe from 'stripe';
import mercadopago from 'mercadopago';
const router = express.Router();

router.post('/stripe/create-checkout', async (req,res)=>{
  try{
    const stripe = new Stripe(process.env.STRIPE_SECRET || '', { apiVersion:'2024-06-20' });
    if(!process.env.STRIPE_SECRET) throw new Error('Stripe não configurado');
    const { email='aluno@cap.ci', priceId='price_xxx', mode='subscription' } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      mode, payment_method_types:['card','pix'],
      line_items:[{ price: priceId, quantity:1 }],
      customer_email: email,
      success_url: (process.env.WEB_URL||'http://localhost:3000') + '/success',
      cancel_url: (process.env.WEB_URL||'http://localhost:3000') + '/cancel'
    });
    res.json({ url: session.url });
  }catch(e){ res.status(400).json({error:e.message}); }
});

router.post('/mp/create', async (req,res)=>{
  try{
    if(!process.env.MP_ACCESS_TOKEN) throw new Error('Mercado Pago não configurado');
    mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
    const { title='Assinatura Capacita', price=19.9, email='aluno@cap.ci' } = req.body || {};
    const pref = await mercadopago.preferences.create({
      items:[{ title, quantity:1, currency_id:'BRL', unit_price:Number(price)}],
      payer:{ email },
      back_urls:{ success:(process.env.WEB_URL||'http://localhost:3000')+'/success',
                  failure:(process.env.WEB_URL||'http://localhost:3000')+'/cancel',
                  pending:(process.env.WEB_URL||'http://localhost:3000')+'/pending' },
      auto_return:'approved'
    });
    res.json({ init_point: pref.body.init_point });
  }catch(e){ res.status(400).json({error:e.message}); }
});

export default router;

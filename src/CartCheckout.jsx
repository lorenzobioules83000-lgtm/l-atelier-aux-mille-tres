import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Initialisation de Stripe avec ta clé PUBLIQUE (publishable key)
const stripePromise = loadStripe('pk_test_TON_ID_PUBLIC_ICI');

export default function CartCheckout({ cartItems }) {
  const [loading, setLoading] = useState(false);

  // Calcul dynamique du total du panier
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // ⚠️ Note de sécurité : En production, cette étape doit appeler un serveur
      // qui génère la session Stripe avec la clé secrète pour éviter la fraude.

      // Simulation d'une redirection ou ouverture du module de paiement :
      const stripe = await stripePromise;

      if (!stripe) {
        throw new Error("Stripe n'a pas pu s'initialiser.");
      }

      // Exemple de redirection vers un lien de paiement ou traitement du panier
      alert(
        `Redirection vers le paiement sécurisé Stripe pour un montant de : ${totalAmount.toFixed(
          2
        )} €`
      );

      // Si tu utilises Stripe Checkout via une API backend, tu ferais :
      // const response = await fetch('/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ cartItems }) });
      // const session = await response.json();
      // await stripe.redirectToCheckout({ sessionId: session.id });
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Mon Panier</h2>

      <div className="divide-y divide-gray-200">
        {cartItems.map((item, index) => (
          <div key={index} className="py-2 flex justify-between">
            <span>
              {item.name} (x{item.quantity})
            </span>
            <span className="font-semibold">
              {(item.price * item.quantity).toFixed(2)} €
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-300 flex justify-between text-lg font-bold">
        <span>Total à régler :</span>
        <span className="text-indigo-600">{totalAmount.toFixed(2)} €</span>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading || totalAmount === 0}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow transition duration-200 disabled:opacity-50"
      >
        {loading ? 'Chargement...' : `Payer ${totalAmount.toFixed(2)} €`}
      </button>
    </div>
  );
}

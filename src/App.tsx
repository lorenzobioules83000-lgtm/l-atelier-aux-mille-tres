import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabaseClient';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_TON_ID_PUBLIC_ICI'
);

interface Product {
  id: number;
  nom: string;
  prix: string;
  categorie: string;
  img: string;
  description: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // États pour l'admin
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    nom: '',
    prix: '',
    categorie: 'Créations florales',
    imgUrl: '',
  });

  // 1. Charger les produits depuis Supabase au démarrage
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement produits:', error);
    } else if (data) {
      setProducts(data);
    }
  };

  // Gestion du panier
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(
      (prevCart) =>
        prevCart
          .map((item) => {
            if (item.id === id) {
              const newQty = item.quantity + delta;
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + parseFloat(item.prix) * item.quantity,
    0
  );

  // 2. Ajouter un produit dans Supabase depuis l'espace Admin
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nom.trim() || !newProduct.prix.trim()) {
      return alert('Merci de renseigner un nom et un prix.');
    }

    const itemToInsert = {
      nom: newProduct.nom.trim(),
      prix: parseFloat(newProduct.prix).toFixed(2),
      categorie: newProduct.categorie,
      img:
        newProduct.imgUrl ||
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500',
      description: 'Création artisanale de L’atelier aux mille trésors.',
    };

    const { error } = await supabase.from('products').insert([itemToInsert]);

    if (error) {
      console.error('Erreur ajout:', error);
      alert("Erreur lors de l'enregistrement du produit.");
    } else {
      alert('Produit ajouté avec succès dans la base de données !');
      setNewProduct({
        nom: '',
        prix: '',
        categorie: 'Créations florales',
        imgUrl: '',
      });
      fetchProducts(); // Recharge la liste en direct
    }
  };

  // 3. Supprimer un produit de Supabase
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      console.error('Erreur suppression:', error);
    } else {
      fetchProducts();
    }
  };

  // 4. Paiement sécurisé Stripe via le backend Vercel
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: cart.map((item) => ({
            name: item.nom,
            price: parseFloat(item.prix),
            quantity: item.quantity,
          })),
        }),
      });

      const session = await response.json();

      if (session.error) {
        alert('Erreur: ' + session.error);
        return;
      }

      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('URL de session introuvable.');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue lors de la redirection vers le paiement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans pb-16">
      {/* Header */}
      <header className="py-4 px-6 bg-white border-b border-[#e7dfe3] sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold font-serif">
          L'atelier aux mille trésors
        </h1>
        <button
          onClick={() => setIsAdminOpen(!isAdminOpen)}
          className="text-xs bg-[#3c2820] text-white px-3 py-1.5 rounded-lg hover:opacity-90"
        >
          {isAdminOpen ? 'Fermer Admin' : '⚙️ Espace Admin'}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Panneau Admin */}
        {isAdminOpen && (
          <div className="mb-10 bg-white p-6 rounded-2xl border border-[#e7dfe3] shadow-md">
            <h2 className="text-lg font-bold mb-4">
              Ajouter un nouveau produit (Base de données)
            </h2>
            <form
              onSubmit={handleAddProduct}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <input
                type="text"
                placeholder="Nom de la création"
                value={newProduct.nom}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, nom: e.target.value })
                }
                className="p-2 border rounded-lg text-sm"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Prix en €"
                value={newProduct.prix}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, prix: e.target.value })
                }
                className="p-2 border rounded-lg text-sm"
              />
              <select
                value={newProduct.categorie}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, categorie: e.target.value })
                }
                className="p-2 border rounded-lg text-sm"
              >
                <option value="Créations florales">Créations florales</option>
                <option value="Objets en bois">Objets en bois</option>
                <option value="Décoration">Décoration</option>
              </select>
              <input
                type="text"
                placeholder="URL de l'image (optionnel)"
                value={newProduct.imgUrl}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, imgUrl: e.target.value })
                }
                className="p-2 border rounded-lg text-sm"
              />
              <button
                type="submit"
                className="sm:col-span-2 bg-[#3c2820] text-white py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Publier le produit sur la vitrine
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Vitrine des produits */}
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-serif font-bold">Nos Créations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl overflow-hidden border border-[#e7dfe3] shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <img
                      src={product.img}
                      alt={product.nom}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <span className="text-xs text-amber-700 font-semibold uppercase">
                        {product.categorie}
                      </span>
                      <h3 className="font-serif font-bold text-lg mt-1">
                        {product.nom}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {product.description}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 pt-0 flex justify-between items-center">
                    <span className="font-bold text-lg">
                      {parseFloat(product.prix).toFixed(2)} €
                    </span>
                    <div className="space-x-2">
                      {isAdminOpen && (
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-[#3c2820] text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panier et Paiement */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e7dfe3] p-6 h-fit space-y-6">
            <h2 className="text-lg font-serif font-bold">Votre Panier</h2>

            {cart.length === 0 ? (
              <p className="text-sm text-gray-500">Votre panier est vide.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-sm">{item.nom}</h4>
                      <p className="text-xs text-gray-500">
                        {item.price} € x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 bg-gray-100 rounded"
                      >
                        -
                      </button>
                      <span className="text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 bg-gray-100 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t flex justify-between items-baseline font-bold">
              <span>Total</span>
              <span className="text-xl">{totalAmount.toFixed(2)} €</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full py-3 bg-[#3c2820] text-white font-semibold rounded-xl shadow hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? 'Paiement en cours...'
                : `Payer ${totalAmount.toFixed(2)} € avec Stripe`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

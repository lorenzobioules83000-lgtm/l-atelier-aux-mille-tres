import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface Product {
  id: number;
  nom: string;  
  prix: string | number;
  categorie: string;
  img: string;
  description: string;
}

interface CartItem {
  id: number;
  nom: string;
  prix: number;
  quantity: number;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping'>('cart');

  const [shippingInfo, setShippingInfo] = useState({
    prenom: '',
    nom: '',
    email: '',
    adresse: '',
    codePostal: '',
    ville: ''
  });

  const logoClicksRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [newProduct, setNewProduct] = useState({
    nom: '',
    prix: '',
    categorie: 'Créations florales',
    imgUrl: '',
    description: ''
  });

  const [categories, setCategories] = useState<string[]>([
    'Créations florales',
    'Objets en bois',
    'Sur-mesure'
  ]);
  const [newCategory, setNewCategory] = useState('');

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

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => { logoClicksRef.current = 0; }, 600);

    if (logoClicksRef.current === 3) {
      logoClicksRef.current = 0;
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

      if (!isAdminOpen) {
        const pwd = prompt('Entrez le mot de passe admin :');
        if (pwd === 'admin123') setIsAdminOpen(true);
        else if (pwd !== null) alert('Mot de passe incorrect !');
      } else {
        setIsAdminOpen(false);
      }
    }
  };

  const addToCart = (product: Product) => {
    const numericPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { id: product.id, nom: product.nom, prix: numericPrice, quantity: 1 }];
    });
    setIsCartOpen(true);
    setCheckoutStep('cart');
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prevCart) =>
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

  const totalAmount = cart.reduce((sum, item) => sum + item.prix * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Fonction pour uploader l'image sur Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      setUploadingImage(true);
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload dans le bucket 'images'
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Récupérer l'URL publique de l'image
      const { data } = supabase.storage.from('images').getPublicUrl(filePath);

      setNewProduct((prev) => ({ ...prev, imgUrl: data.publicUrl }));
      alert('Image uploadée avec succès !');
    } catch (error) {
      alert("Erreur lors de l'upload de l'image.");
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nom.trim() || !newProduct.prix.trim()) {
      return alert('Merci de renseigner un nom et un prix.');
    }

    let finalCategory = newProduct.categorie;
    if (newCategory.trim()) {
      finalCategory = newCategory.trim();
      if (!categories.includes(finalCategory)) {
        setCategories([...categories, finalCategory]);
      }
    }

    const itemToInsert = {
      nom: newProduct.nom.trim(),
      prix: parseFloat(newProduct.prix).toFixed(2),
      categorie: finalCategory,
      img: newProduct.imgUrl.trim() || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500',
      description: newProduct.description.trim() || 'Création artisanale de L’atelier aux mille trésors.',
    };

    const { error } = await supabase.from('products').insert([itemToInsert]);

    if (error) {
      alert("Erreur lors de l'enregistrement du produit.");
    } else {
      alert('Produit ajouté avec succès !');
      setNewProduct({ nom: '', prix: '', categorie: categories[0] || 'Créations florales', imgUrl: '', description: '' });
      setNewCategory('');
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  const handleFinalOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingInfo.prenom || !shippingInfo.nom || !shippingInfo.email || !shippingInfo.adresse || !shippingInfo.codePostal || !shippingInfo.ville) {
      return alert('Veuillez remplir tous les champs de livraison.');
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Commande validée avec succès ! Merci pour votre achat.');
      setCart([]);
      setIsCartOpen(false);
      setCheckoutStep('cart');
      setShippingInfo({ prenom: '', nom: '', email: '', adresse: '', codePostal: '', ville: '' });
    }, 1000);
  };

  if (isAdminOpen) {
    return (
      <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans p-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full border border-[#e7dfe3]" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
            <h1 className="text-2xl font-bold font-serif">Administration</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAdminOpen(false)} className="px-4 py-2 bg-white border border-[#3c2820]/20 rounded-xl text-sm font-semibold shadow-xs hover:bg-[#f5efe6]">Voir le site</button>
            <button onClick={() => setIsAdminOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Déconnexion</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-[#3c2820]/15 shadow-sm md:col-span-1 h-fit space-y-4">
            <h2 className="text-lg font-bold">➕ Ajouter un article</h2>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <input type="text" placeholder="Nom du produit" value={newProduct.nom} onChange={(e) => setNewProduct({ ...newProduct, nom: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
              <input type="number" step="0.01" placeholder="Prix (€)" value={newProduct.prix} onChange={(e) => setNewProduct({ ...newProduct, prix: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
              
              <select value={newProduct.categorie} onChange={(e) => setNewProduct({ ...newProduct, categorie: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none bg-white">
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <input type="text" placeholder="Ou nouvelle catégorie..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full p-3 border border-dashed border-[#3c2820]/30 rounded-xl text-sm focus:outline-none" />
              
              {/* CHAMP UPLOAD DEPUIS L'APPAREIL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Importer une image :</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="w-full p-2 border border-[#3c2820]/20 rounded-xl text-xs bg-[#faf7f2] file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#c58a79] file:text-white hover:file:opacity-90" 
                />
                {uploadingImage && <p className="text-xs text-amber-700">Upload en cours...</p>}
                {newProduct.imgUrl && !uploadingImage && <p className="text-xs text-green-600">✓ Image prête</p>}
              </div>

              <textarea placeholder="Description" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none" rows={2}></textarea>

              <button type="submit" style={{ backgroundColor: '#c58a79', color: '#ffffff' }} className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90">Publier</button>
            </form>
          </div>

          <div className="md:col-span-2 space-y-6">
            <h2 className="text-xl font-serif font-bold">Catégories actuelles</h2>
            <div className="bg-white p-4 rounded-2xl border border-[#3c2820]/15 space-y-2 mb-6">
              {categories.map((cat) => (
                <div key={cat} className="flex justify-between items-center py-2 px-3 bg-[#faf7f2] rounded-xl text-sm font-medium">
                  <span>{cat}</span>
                  <span className="text-xs text-amber-800">✏️</span>
                </div>
              ))}
            </div>

            <h2 className="text-xl font-serif font-bold">Catalogue actuel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#3c2820]/15 shadow-xs flex flex-col justify-between p-4">
                  <div>
                    <img src={product.img} alt={product.nom} className="w-full h-36 object-cover rounded-xl mb-3" />
                    <span className="text-[10px] bg-[#faf7f2] text-[#3c2820] px-2.5 py-1 rounded-full font-semibold uppercase">{product.categorie}</span>
                    <h3 className="font-serif font-bold text-base mt-2">{product.nom}</h3>
                    <p className="text-sm font-bold mt-1 text-[#c58a79]">{Number(product.prix).toFixed(2)} €</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-gray-400 hover:text-red-500 p-1 text-sm">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans pb-16 relative">
      <header className="py-4 px-6 bg-white border-b border-[#3c2820]/10 sticky top-0 z-20 flex justify-between items-center shadow-xs">
        <div onClick={handleLogoClick} className="flex items-center space-x-3 cursor-pointer select-none">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full border border-[#3c2820]/15" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
          <h1 className="text-xl font-bold font-serif">L'atelier aux mille trésors</h1>
        </div>
        <button
          onClick={() => { setIsCartOpen(true); setCheckoutStep('cart'); }}
          className="flex items-center space-x-2 bg-[#f5efe6] border border-[#3c2820]/15 px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#ede5d8] transition shadow-xs"
        >
          <span>🛒 Panier ({totalItemsCount})</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-bold">Nos Créations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => {
              const displayPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;
              return (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#3c2820]/15 shadow-xs flex flex-col justify-between">
                  <div>
                    <img src={product.img} alt={product.nom} className="w-full h-48 object-cover" />
                    <div className="p-4">
                      <span className="text-[10px] bg-[#faf7f2] px-2.5 py-1 rounded-full text-[#3c2820] font-semibold uppercase">{product.categorie}</span>
                      <h3 className="font-serif font-bold text-lg mt-2">{product.nom}</h3>
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-2 flex items-center justify-between border-t border-gray-100 bg-white">
                    <span className="font-bold text-lg">
                      {!isNaN(displayPrice) ? displayPrice.toFixed(2) : '0.00'} €
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="px-5 py-2 rounded-xl text-sm font-semibold shadow-xs transition hover:opacity-90 active:scale-95"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-xs" onClick={() => setIsCartOpen(false)} />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-[#3c2820]/10">
                    {checkoutStep === 'shipping' ? (
                      <button onClick={() => setCheckoutStep('cart')} className="text-xs font-semibold text-gray-600 hover:text-black">← Retour au panier</button>
                    ) : (
                      <h2 className="text-lg font-serif font-bold">Mon Panier</h2>
                    )}
                    <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-black font-bold text-lg px-2">✕</button>
                  </div>

                  {checkoutStep === 'cart' ? (
                    <>
                      {cart.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-10 text-center">Votre panier est vide.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 mt-4 max-h-[55vh] overflow-y-auto pr-1">
                          {cart.map((item) => (
                            <div key={item.id} className="py-3 flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <h4 className="font-medium text-sm">{item.nom}</h4>
                                  <p className="text-xs text-gray-500">{(item.prix).toFixed(2)} €</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button onClick={() => updateQuantity(item.id, -1)} className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-bold">-</button>
                                <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-bold">+</button>
                                <button onClick={() => updateQuantity(item.id, -item.quantity)} className="text-gray-400 hover:text-red-500 ml-2 text-xs">🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleFinalOrder} id="shipping-form" className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      <h3 className="font-serif font-bold text-sm text-[#3c2820] mb-2">Informations de livraison & Paiement</h3>
                      <input type="text" placeholder="Prénom" required value={shippingInfo.prenom} onChange={(e)=>setShippingInfo({...shippingInfo, prenom: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                      <input type="text" placeholder="Nom" required value={shippingInfo.nom} onChange={(e)=>setShippingInfo({...shippingInfo, nom: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                      <input type="email" placeholder="Adresse e-mail" required value={shippingInfo.email} onChange={(e)=>setShippingInfo({...shippingInfo, email: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                      <input type="text" placeholder="Adresse postale" required value={shippingInfo.adresse} onChange={(e)=>setShippingInfo({...shippingInfo, adresse: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Code postal" required value={shippingInfo.codePostal} onChange={(e)=>setShippingInfo({...shippingInfo, codePostal: e.target.value})} className="p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                        <input type="text" placeholder="Ville" required value={shippingInfo.ville} onChange={(e)=>setShippingInfo({...shippingInfo, ville: e.target.value})} className="p-2.5 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none focus:border-[#3c2820]" />
                      </div>
                    </form>
                  )}
                </div>

                <div className="pt-4 border-t border-[#3c2820]/10 space-y-4">
                  <div className="flex justify-between items-baseline font-bold">
                    <span>Total :</span>
                    <span className="text-xl">{totalAmount.toFixed(2)} €</span>
                  </div>

                  {checkoutStep === 'cart' ? (
                    <button
                      onClick={() => setCheckoutStep('shipping')}
                      disabled={cart.length === 0}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90 disabled:opacity-50"
                    >
                      Passer à la livraison
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="shipping-form"
                      disabled={loading}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Traitement...' : `Payer et commander (${totalAmount.toFixed(2)} €) 💳`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
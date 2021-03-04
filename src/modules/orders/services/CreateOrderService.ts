import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer nao existe');
    }

    const productsExists = await this.productsRepository.findAllById(
      products.map(product => ({ id: product.id })),
    );

    if (products.length !== productsExists.length) {
      throw new AppError('Ha um produto invalido');
    }

    const orderProducts = products.map(product => {
      const existingProduct = productsExists.find(
        find => find.id === product.id,
      );
      if (!existingProduct) {
        throw new AppError('Nao encontrou igual');
      }
      if (existingProduct.quantity < product.quantity) {
        throw new AppError('Nao pode comprar mais do que tem');
      }
      return {
        product_id: product.id,
        price: existingProduct.price * product.quantity,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    if (!order) {
      throw new AppError('Order nao foi criada');
    }

    const updateQuantity: IUpdateProductsQuantityDTO[] = productsExists.map(
      product => {
        const subtractQuant =
          products.find(find => find.id === product.id)?.quantity || 0;

        return {
          id: product.id,
          quantity: product.quantity - subtractQuant,
        };
      },
    );

    await this.productsRepository.updateQuantity(updateQuantity);

    return order;
  }
}

export default CreateOrderService;
